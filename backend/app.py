import json
import os
import sys
from datetime import datetime
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db, storage
from flask import Flask, request, jsonify

# ---------------- FLASK APP ----------------
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# ---------------- FIREBASE ----------------
firebase_json = "ethiostore-17d9f-firebase-adminsdk-5e87k-ff766d2648.json"
if not os.path.exists(firebase_json):
    print("Firebase JSON missing")
    sys.exit()


CRED_PATH = os.environ.get(
    'GOOGLE_APPLICATION_CREDENTIALS', 
    os.path.join(os.path.dirname(__file__), 'ethiostore-17d9f-firebase-adminsdk-5e87k-ff766d2648.json')
)

cred = credentials.Certificate(firebase_json)
firebase_admin.initialize_app(cred, {
    "databaseURL": "https://ethiostore-17d9f-default-rtdb.firebaseio.com/",
    "storageBucket": "ethiostore-17d9f.appspot.com"
})
bucket = storage.bucket()
posts_ref = db.reference("/TeacherPosts")


@app.route('/healthz')
def healthz():
    return "OK", 200


# ===================== HOME PAGE =====================
@app.route('/')
def home():
    return render_template('student_register.html')



# New endpoint: reserve & return the next studentId
@app.route("/generate/student_id", methods=["GET"])
def generate_student_id():
    """
    Atomically increment the students counter and return a studentId in format:
      GES_<zero-padded-4+>_<YY>  e.g. GES_0001_26
    This reserves that sequence number.
    """
    try:
        counters_ref = db.reference("Users_counters/students")
        students_ref = db.reference("Students")

        # Defensive: bring counter up to existing max (one-time migration)
        existing_students = students_ref.get() or {}
        max_found = 0
        for s in existing_students.values():
            sid = (s.get("studentId") or "")
            if sid and sid.startswith("GES_"):
                parts = sid.split("_")
                if len(parts) >= 3:
                    try:
                        num = int(parts[1].lstrip("0") or "0")
                        if num > max_found:
                            max_found = num
                    except Exception:
                        continue

        try:
            current_counter = counters_ref.get() or 0
            if current_counter < max_found:
                counters_ref.set(max_found)
        except Exception:
            pass

        def tx_inc(curr):
            return (curr or 0) + 1

        new_seq = counters_ref.transaction(tx_inc)
        if not isinstance(new_seq, int):
            new_seq = int(new_seq)

        year = datetime.utcnow().year
        year_suffix = str(year)[-2:]
        seq_padded = str(new_seq).zfill(4)
        student_id = f"GES_{seq_padded}_{year_suffix}"

        # Extremely unlikely collision check (increment until unique)
        attempts = 0
        while students_ref.child(student_id).get():
            new_seq += 1
            seq_padded = str(new_seq).zfill(4)
            student_id = f"GES_{seq_padded}_{year_suffix}"
            attempts += 1
            if attempts > 1000:
                # fallback to timestamp-based id
                student_id = f"GES_{str(int(datetime.utcnow().timestamp()))[-6:]}_{year_suffix}"
                break

        return jsonify({"success": True, "studentId": student_id})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# Updated register_student: use provided studentId when present
@app.route('/register/student', methods=['POST'])
def register_student():
    """
    Register a student. If the frontend does not provide a username,
    the server generates a unique studentId and uses it as the username.
    studentId format: GES_<zero-padded-4+>_<YY>, e.g. GES_0001_26
    Students record is written under Students/<studentId>.
    """
    from datetime import datetime

    data = request.form
    profile_file = request.files.get('profile')

    # Frontend no longer submits username; server will set username = studentId
    provided_username = (data.get('username') or "").strip()  # if frontend ever sends it
    name = (data.get('name') or "").strip()
    password = data.get('password') or ""
    grade = data.get('grade') or ""
    section = data.get('section') or ""

    # Optional fields
    email = (data.get('email') or "").strip()
    phone = (data.get('phone') or "").strip()
    dob = data.get('dob') or ""
    gender = data.get('gender') or ""

    if not all([name, password, grade, section]):
        return jsonify({'success': False, 'message': 'Name, password, grade and section are required.'}), 400

    users_ref = db.reference('Users')
    students_ref = db.reference('Students')
    counters_ref = db.reference('counters/students')

    # ---------- upload profile image (optional) ----------
    profile_url = "/default-profile.png"
    if profile_file:
        filename = f"students/{(provided_username or 'student')}_{profile_file.filename}"
        blob = bucket.blob(filename)
        blob.upload_from_file(profile_file, content_type=profile_file.content_type)
        blob.make_public()
        profile_url = blob.public_url

    # ========== Generate studentId atomically ==========
    try:
        # Defensive: compute numeric max already present (if any)
        existing_students = students_ref.get() or {}
        max_found = 0
        for s in existing_students.values():
            sid = (s.get('studentId') or "")
            if sid and sid.startswith("GES_"):
                parts = sid.split('_')
                if len(parts) >= 3:
                    try:
                        num = int(parts[1].lstrip('0') or '0')
                        if num > max_found:
                            max_found = num
                    except Exception:
                        continue

        # ensure counter isn't behind
        try:
            current_counter = counters_ref.get() or 0
            if current_counter < max_found:
                counters_ref.set(max_found)
        except Exception:
            pass

        # transaction to allocate next sequence number
        def tx_increment(curr):
            return (curr or 0) + 1

        new_seq = counters_ref.transaction(tx_increment)
        if not isinstance(new_seq, int):
            new_seq = int(new_seq)

        year = datetime.utcnow().year
        year_suffix = str(year)[-2:]
        seq_padded = str(new_seq).zfill(4)
        student_id = f"GES_{seq_padded}_{year_suffix}"

        # ensure student_id and username will be unique; if conflict, bump counter
        attempts = 0
        while True:
            # check student key existence and username collision
            student_exists = bool(students_ref.child(student_id).get())
            # check username collision (if provided_username present we handle below; here we plan to use student_id as username)
            user_collision = False
            all_users = users_ref.get() or {}
            for u in all_users.values():
                if u.get('username') == student_id:
                    user_collision = True
                    break

            if not student_exists and not user_collision:
                break

            # collision -> increment counter and try next
            new_seq += 1
            seq_padded = str(new_seq).zfill(4)
            student_id = f"GES_{seq_padded}_{year_suffix}"
            attempts += 1
            if attempts > 1000:
                # fallback
                student_id = f"GES_{str(int(datetime.utcnow().timestamp()))[-6:]}_{year_suffix}"
                break
    except Exception as e:
        # fallback if transaction fails
        year = datetime.utcnow().year
        year_suffix = str(year)[-2:]
        student_id = f"GES_{str(int(datetime.utcnow().timestamp()))[-6:]}_{year_suffix}"

    # If frontend supplied an explicit username, use it (but check uniqueness). Otherwise set username = student_id
    username = provided_username or student_id

    # Check username uniqueness (if frontend provided, reject; if we assigned, collision already checked above)
    all_users = users_ref.get() or {}
    for user in all_users.values():
        if user.get('username') == username:
            # If username equals provided_username (user attempted to set), reject with error
            if provided_username:
                return jsonify({'success': False, 'message': 'Username already exists!'}), 400
            else:
                # If collision occurred when username=student_id (very unlikely), increment counter and regenerate student_id & username
                # Simple fallback: append random suffix (to guarantee uniqueness)
                import random, string
                suffix = ''.join(random.choices(string.digits, k=3))
                username = f"{student_id}_{suffix}"
                break

    academic_year = f"{year-1}_{year}"

    # ========== Create Users entry (push key) ==========
    new_user_ref = users_ref.push()
    user_data = {
        'userId': new_user_ref.key,
        'username': username,
        'name': name,
        'password': password,     # TODO: hash in production
        'profileImage': profile_url,
        'role': 'student',
        'isActive': True,
        'email': email,
        'phone': phone,
        'dob': dob,
        'gender': gender,
        'studentId': student_id
    }
    new_user_ref.set(user_data)

    # ========== Create Students entry keyed by studentId ==========
    student_data = {
        'userId': new_user_ref.key,
        'studentId': student_id,
        'academicYear': academic_year,
        'dob': dob,
        'grade': grade,
        'section': section,
        'status': 'active',
    }
    students_ref.child(student_id).set(student_data)

    return jsonify({
        'success': True,
        'message': 'Student registered successfully!',
        'studentId': student_id,
        'username': username,
        'profileImage': profile_url
    })
# ===================== TEACHER REGISTRATION =====================
@app.route('/register/teacher', methods=['POST'])
def register_teacher():
    """
    Register a teacher. If frontend does not provide username, server will generate
    a teacherId in format GET_<zero-padded-4+>_<YY> (e.g. GET_0001_26) and use it
    as the username. Teacher record is written under Teachers/<teacherId>.
    Response includes teacherKey (teacherId) so frontend can display it.
    """
    from datetime import datetime
    import json

    name = request.form.get('name')
    provided_username = (request.form.get('username') or "").strip()
    password = request.form.get('password')
    email = request.form.get('email')
    phone = request.form.get('phone')
    gender = request.form.get('gender')
    courses = json.loads(request.form.get('courses', '[]'))
    profile_file = request.files.get('profile')

    if not all([name, password]):
        return jsonify({'success': False, 'message': 'Name and password are required.'}), 400

    users_ref = db.reference('Users')
    teachers_ref = db.reference('Teachers')
    courses_ref = db.reference('Courses')
    assignments_ref = db.reference('TeacherAssignments')
    counters_ref = db.reference('counters/teachers')

    # check username uniqueness if provided (we won't rely on frontend providing it)
    all_users = users_ref.get() or {}
    if provided_username:
        for u in all_users.values():
            if u.get('username') == provided_username:
                return jsonify({'success': False, 'message': 'Username already exists!'}), 400

    # subject conflict check (existing assignments)
    existing_assignments = assignments_ref.get() or {}
    for course in courses:
        grade = course.get('grade')
        section = course.get('section')
        subject = course.get('subject')
        course_id = f"course_{subject.lower()}_{grade}{section.upper()}"
        for a in existing_assignments.values():
            if a.get('courseId') == course_id:
                return jsonify({'success': False, 'message': f'{subject} already assigned in Grade {grade}{section}'}), 400

    # profile upload
    profile_url = "/default-profile.png"
    if profile_file:
        filename = f"teachers/{(provided_username or name).replace(' ','_')}_{profile_file.filename}"
        blob = bucket.blob(filename)
        blob.upload_from_file(profile_file, content_type=profile_file.content_type)
        blob.make_public()
        profile_url = blob.public_url

    # generate teacherId if no username provided
    try:
        # compute max existing seq (defensive)
        existing_teachers = teachers_ref.get() or {}
        max_found = 0
        for t in existing_teachers.values():
            tid = (t.get('teacherId') or "")
            if tid and tid.startswith("GET_"):
                parts = tid.split('_')
                if len(parts) >= 3:
                    try:
                        num = int(parts[1].lstrip('0') or '0')
                        if num > max_found:
                            max_found = num
                    except Exception:
                        continue
        try:
            current_counter = counters_ref.get() or 0
            if current_counter < max_found:
                counters_ref.set(max_found)
        except Exception:
            pass

        def tx_inc(curr):
            return (curr or 0) + 1

        new_seq = counters_ref.transaction(tx_inc)
        if not isinstance(new_seq, int):
            new_seq = int(new_seq)

        year = datetime.utcnow().year
        year_suffix = str(year)[-2:]
        seq_padded = str(new_seq).zfill(4)
        teacher_id = f"GET_{seq_padded}_{year_suffix}"

        # ensure uniqueness for teacherId and username
        attempts = 0
        while teachers_ref.child(teacher_id).get() or any(u.get('username') == teacher_id for u in (users_ref.get() or {}).values()):
            new_seq += 1
            seq_padded = str(new_seq).zfill(4)
            teacher_id = f"GET_{seq_padded}_{year_suffix}"
            attempts += 1
            if attempts > 1000:
                teacher_id = f"GET_{str(int(datetime.utcnow().timestamp()))[-6:]}_{year_suffix}"
                break
    except Exception:
        year = datetime.utcnow().year
        year_suffix = str(year)[-2:]
        teacher_id = f"GET_{str(int(datetime.utcnow().timestamp()))[-6:]}_{year_suffix}"

    # final username: either provided_username or teacher_id
    username = provided_username or teacher_id

    # create Users entry (push key)
    new_user_ref = users_ref.push()
    user_data = {
        'userId': new_user_ref.key,
        'username': username,
        'name': name,
        'password': password,  # TODO: hash before production
        'role': 'teacher',
        'isActive': True,
        'profileImage': profile_url,
        'email': email,
        'phone': phone,
        'gender': gender,
        'teacherId': teacher_id
    }
    new_user_ref.set(user_data)

    # create Teachers entry keyed by teacherId
    teacher_data = {
        'userId': new_user_ref.key,
        'teacherId': teacher_id,
        'status': 'active',
       
    }
    teachers_ref.child(teacher_id).set(teacher_data)

    # assign courses (use teacher_id as identifier)
    for course in courses:
        grade = course.get('grade')
        section = course.get('section')
        subject = course.get('subject')
        course_id = f"course_{subject.lower()}_{grade}{section.upper()}"
        if not courses_ref.child(course_id).get():
            courses_ref.child(course_id).set({
                'name': subject,
                'subject': subject,
                'grade': grade,
                'section': section
            })
        assignments_ref.push().set({
            'teacherId': teacher_id,
            'courseId': course_id
        })

    return jsonify({
        'success': True,
        'message': 'Teacher registered successfully!',
        'teacherKey': teacher_id,
        'profileImage': profile_url
    })

# ===================== TEACHER LOGIN =====================
@app.route("/api/teacher_login", methods=["POST"])
def teacher_login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"success": False, "message": "Username and password required"}), 400

    users_ref = db.reference("Users")
    teachers_ref = db.reference("Teachers")

    all_users = users_ref.get() or {}
    all_teachers = teachers_ref.get() or {}

    teacher_user = None
    teacher_key = None
    for key, user in all_users.items():
        if user.get("username") == username and user.get("role") == "teacher":
            teacher_user = user
            # Match with Teachers node
            for tkey, tdata in all_teachers.items():
                if tdata.get("userId") == key:
                    teacher_key = tkey
                    break
            break

    if not teacher_user or not teacher_key:
        return jsonify({"success": False, "message": "Teacher not found"}), 404

    if teacher_user.get("password") != password:
        return jsonify({"success": False, "message": "Invalid password"}), 401

    profile_image = all_teachers.get(teacher_key, {}).get("profileImage", "/default-profile.png")

    return jsonify({
        "success": True,
        "teacher": {
            "teacherKey": teacher_key,
            "userId": teacher_user["userId"],
            "name": teacher_user.get("name"),
            "username": teacher_user.get("username"),
            "profileImage": profile_image
        }
    })


# ===================== GET TEACHER COURSES =====================
@app.route('/api/teacher/<teacher_key>/courses', methods=['GET'])
def get_teacher_courses(teacher_key):
    assignments_ref = db.reference('TeacherAssignments')
    courses_ref = db.reference('Courses')

    all_assignments = assignments_ref.get() or {}
    courses_list = []

    for assign in all_assignments.values():
        if assign.get('teacherId') == teacher_key:
            course_id = assign.get('courseId')
            course_data = courses_ref.child(course_id).get()
            if course_data:
                courses_list.append({
                    'courseId': course_id,
                    'subject': course_data.get('subject'),
                    'grade': course_data.get('grade'),
                    'section': course_data.get('section')
                })

    return jsonify({'courses': courses_list})


# ===================== GET TEACHER STUDENTS =====================
@app.route("/api/teacher/<user_id>/students", methods=["GET"])
def get_teacher_students(user_id):
    teachers_ref = db.reference("Teachers")
    assignments_ref = db.reference("TeacherAssignments")
    courses_ref = db.reference("Courses")
    students_ref = db.reference("Students")
    users_ref = db.reference("Users")
    marks_ref = db.reference("ClassMarks")

    # 1️⃣ Get the teacher key from Teachers node using user_id
    teacher_key = None
    all_teachers = teachers_ref.get() or {}
    for key, teacher in all_teachers.items():
        if teacher.get("userId") == user_id:
            teacher_key = key
            break

    if not teacher_key:
        return jsonify({"courses": [], "message": "Teacher not found"})

    # 2️⃣ Get all assignments for this teacher
    all_assignments = assignments_ref.get() or {}
    course_students = []

    for assign in all_assignments.values():
        if assign.get("teacherId") != teacher_key:
            continue

        course_id = assign.get("courseId")
        course_data = courses_ref.child(course_id).get()
        if not course_data:
            continue

        grade = course_data.get("grade")
        section = course_data.get("section")
        subject = course_data.get("subject")

        # 3️⃣ Fetch students in this grade + section
        students_list = []
        all_students = students_ref.get() or {}
        for student_id, student in all_students.items():
            if student.get("grade") == grade and student.get("section") == section:
                user_data = users_ref.child(student.get("userId")).get()
                if not user_data:
                    continue

                # Get marks for this course
                student_marks = marks_ref.child(course_id).child(student_id).get() or {}

                students_list.append({
                    "studentId": student_id,
                    "name": user_data.get("name"),
                    "username": user_data.get("username"),
                    "marks": {
                        "mark20": student_marks.get("mark20", 0),
                        "mark30": student_marks.get("mark30", 0),
                        "mark50": student_marks.get("mark50", 0)
                    }
                })

        course_students.append({
            "subject": subject,
            "grade": grade,
            "section": section,
            "students": students_list
        })

    return jsonify({"courses": course_students})


# ===================== GET STUDENTS OF A COURSE =====================
@app.route('/api/course/<course_id>/students', methods=['GET'])
def get_course_students(course_id):
    courses_ref = db.reference('Courses')
    students_ref = db.reference('Students')
    users_ref = db.reference('Users')
    marks_ref = db.reference('ClassMarks')

    course = courses_ref.child(course_id).get()
    if not course:
        return jsonify({'students': [], 'course': None})

    grade = course.get('grade')
    section = course.get('section')

    all_students = students_ref.get() or {}
    all_users = users_ref.get() or {}
    course_students = []

    for student_id, student in all_students.items():
        if student.get('grade') == grade and student.get('section') == section:
            user_data = all_users.get(student.get('userId'))
            if user_data:
                student_marks = marks_ref.child(course_id).child(student_id).get() or {}
                course_students.append({
                    'studentId': student_id,
                    'name': user_data.get('name'),
                    'username': user_data.get('username'),
                    'marks': {
                        'mark20': student_marks.get('mark20', 0),
                        'mark30': student_marks.get('mark30', 0),
                        'mark50': student_marks.get('mark50', 0),
                        'mark100': student_marks.get('mark100', 0)
                    }
                })

    return jsonify({
        'students': course_students,
        'course': {
            'subject': course.get('subject'),
            'grade': grade,
            'section': section
        }
    })


# ===================== UPDATE STUDENT MARKS =====================
@app.route('/api/course/<course_id>/update-marks', methods=['POST'])
def update_course_marks(course_id):
    data = request.json
    updates = data.get('updates', [])
    marks_ref = db.reference('ClassMarks')

    for update in updates:
        student_id = update.get('studentId')
        marks = update.get('marks', {})
        marks_ref.child(course_id).child(student_id).set({
            'mark20': marks.get('mark20', 0),
            'mark30': marks.get('mark30', 0),
            'mark50': marks.get('mark50', 0)
        })

    return jsonify({'success': True, 'message': 'Marks updated successfully!'})


# ===================== GET POSTS =====================
@app.route("/api/get_posts", methods=["GET"])
def get_posts():
    posts_ref = db.reference("Posts")
    users_ref = db.reference("Users")

    all_posts = posts_ref.get() or {}
    all_users = users_ref.get() or {}

    result = []

    for post_id, post in all_posts.items():
        user_id = post.get("adminId")  # ⚠️ THIS IS userId

        user = all_users.get(user_id, {})

        result.append({
            "postId": post_id,
            "adminId": user_id,
            "adminName": user.get("name", "Admin"),
            "adminProfile": user.get("profileImage", "/default-profile.png"),
            "message": post.get("message", ""),
            "postUrl": post.get("postUrl"),
            "timestamp": post.get("time", ""),
            "likeCount": post.get("likeCount", 0),
            "likes": post.get("likes", {})
        })

    result.sort(key=lambda x: x["timestamp"], reverse=True)
    return jsonify(result)




@app.route("/api/mark_teacher_post_seen", methods=["POST"])
def mark_teacher_post_seen():
    try:
        data = request.get_json()
        post_id = data.get("postId")
        teacher_id = data.get("teacherId")

        if not post_id or not teacher_id:
            return jsonify({"success": False, "message": "Missing postId or teacherId"}), 400

        post_ref = posts_ref.child(post_id)
        post = post_ref.get()

        if not post:
            return jsonify({"success": False, "message": "Post not found"}), 404

        seen_by = post.get("seenBy", {})
        seen_by[teacher_id] = True
        post_ref.update({"seenBy": seen_by})

        return jsonify({"success": True}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500


# ===================== PARENT REGISTRATION =====================
@app.route('/register/parent', methods=['POST'])
def register_parent():
    name = request.form.get('name')
    username = request.form.get('username')
    phone = request.form.get('phone')
    password = request.form.get('password')
    profile_file = request.files.get('profile')

    # Multiple children
    student_ids = request.form.getlist('studentId')
    relationships = request.form.getlist('relationship')

    # Validation
    if not all([name, username, phone, password]) or not student_ids or not relationships:
        return jsonify({
            "success": False,
            "message": "All fields except profile photo are required"
        }), 400

    if len(student_ids) != len(relationships):
        return jsonify({
            "success": False,
            "message": "Each student must have a relationship"
        }), 400

    users_ref = db.reference('Users')
    parents_ref = db.reference('Parents')
    students_ref = db.reference('Students')

    # Check username uniqueness
    all_users = users_ref.get() or {}
    for user in all_users.values():
        if user.get("username") == username:
            return jsonify({
                "success": False,
                "message": "Username already exists"
            }), 409

    # Upload profile image (optional)
    profile_url = "/default-profile.png"
    if profile_file:
        filename = f"parents/{username}_{profile_file.filename}"
        blob = bucket.blob(filename)
        blob.upload_from_file(profile_file, content_type=profile_file.content_type)
        blob.make_public()
        profile_url = blob.public_url

    # 1️⃣ Create parent USER
    new_user_ref = users_ref.push()
    parent_user_id = new_user_ref.key

    new_user_ref.set({
        "userId": parent_user_id,
        "username": username,
        "phone": phone,
        "name": name,
        "password": password,  # ⚠ hash later
        "role": "parent",
        "profileImage": profile_url,
        "isActive": True
    })

    # 2️⃣ Create PARENT node (new parentId)
    parent_ref = parents_ref.push()
    parent_id = parent_ref.key

    parent_ref.set({
        "userId": parent_user_id,
        "status": "active",
        "createdAt": datetime.utcnow().isoformat(),
        "children": {}
    })

    # 3️⃣ Link children BOTH ways
    for student_id, relationship in zip(student_ids, relationships):
        student_data = students_ref.child(student_id).get()
        if not student_data:
            continue  # skip invalid student

        # Add child under Parents
        parent_ref.child("children").push({
            "studentId": student_id,
            "relationship": relationship
        })

        # Add parent under Students
        students_ref.child(student_id).child("parents").child(parent_id).set({
            "relationship": relationship
        })

    return jsonify({
        "success": True,
        "message": "Parent registered successfully",
        "parentId": parent_id,
        "parentUserId": parent_user_id
    })




# like teacher

@app.route("/api/like_post", methods=["POST"])
def like_post():
    data = request.json
    postId = data.get("postId")
    teacherId = data.get("teacherId")

    posts_ref = db.reference("Posts")
    post = posts_ref.child(postId).get()

    if not post:
        return jsonify({"error": "Post not found"}), 404

    likes = post.get("likes", {})

    if teacherId in likes:
        # Teacher already liked → unlike
        likes.pop(teacherId)
    else:
        # Add like
        likes[teacherId] = True

    posts_ref.child(postId).update({
        "likes": likes,
        "likeCount": len(likes)
    })

    return jsonify({"success": True, "likeCount": len(likes), "liked": teacherId in likes})


# ===================== SAVE WEEK LESSON PLAN =====================
@app.route('/api/lesson-plans/save-week', methods=['POST'])
def save_week_lesson_plan():
    try:
        data = request.get_json() or {}
        teacher_id = data.get('teacherId')
        course_id = data.get('courseId')
        academic_year = data.get('academicYear') or 'default'
        week = data.get('week')
        week_topic = data.get('weekTopic')
        days = data.get('days') or []

        if not teacher_id or week is None:
            return jsonify({'success': False, 'message': 'teacherId and week are required'}), 400

        if not course_id:
            return jsonify({'success': False, 'message': 'courseId is required'}), 400

        # Normalize week key (string)
        week_key = f"week_{str(week)}"

        # Save per-course under courses/<course_id>/<week_key>
        lesson_ref = db.reference('LessonPlans').child(teacher_id).child(academic_year).child('courses').child(course_id).child(week_key)

        # Structure to save
        obj = {
            'teacherId': teacher_id,
            'courseId': course_id,
            'academicYear': academic_year,
            'week': week,
            'weekTopic': week_topic,
            'days': days,
            'updatedAt': datetime.utcnow().isoformat()
        }

        lesson_ref.set(obj)

        return jsonify({'success': True, 'message': 'Week plan saved', 'data': obj}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500



@app.route('/api/lesson-plans/save-annual', methods=['POST'])
def save_annual_lesson_plan():
    try:
        data = request.get_json() or {}
        teacher_id = data.get('teacherId')
        course_id = data.get('courseId')
        academic_year = data.get('academicYear') or 'default'
        annual_rows = data.get('annualRows', [])

        if not teacher_id:
            return jsonify({'success': False, 'message': 'teacherId is required'}), 400

        if not course_id:
            return jsonify({'success': False, 'message': 'courseId is required'}), 400

        # Save per-course annual under courses/<course_id>/annual
        lesson_ref = db.reference('LessonPlans').child(teacher_id).child(academic_year).child('courses').child(course_id)

        obj = {
            'teacherId': teacher_id,
            'courseId': course_id,
            'academicYear': academic_year,
            'annualRows': annual_rows,
            'updatedAt': datetime.utcnow().isoformat()
        }

        lesson_ref.child('annual').set(obj)

        return jsonify({'success': True, 'message': 'Annual plan saved', 'data': obj}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/lesson-plans/<teacher_id>', methods=['GET'])
def get_lesson_plans(teacher_id):
    try:
        academic_year = request.args.get('academicYear') or '2025/26'

        lesson_ref = db.reference('LessonPlans').child(teacher_id).child(academic_year)

        course_id = request.args.get('courseId')
        if course_id:
            course_node = lesson_ref.child('courses').child(course_id).get() or {}
            return jsonify({'success': True, 'data': course_node}), 200

        # If no courseId provided, return entire academic year tree
        data = lesson_ref.get() or {}
        return jsonify({'success': True, 'data': data}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# ===================== LESSON PLAN SUBMISSIONS (daily) =====================
@app.route('/api/lesson-plans/submissions', methods=['GET'])
def get_lesson_plan_submissions():
    try:
        teacher_id = request.args.get('teacherId')
        course_id = request.args.get('courseId')
        academic_year = request.args.get('academicYear') or '2025/26'

        if not teacher_id or not course_id:
            return jsonify({'success': False, 'message': 'teacherId and courseId are required'}), 400

        ref = db.reference('LessonPlanSubmissions').child(teacher_id).child(academic_year).child(course_id)
        data = ref.get() or {}

        results = []
        for child_key, val in (data.items() if isinstance(data, dict) else []):
            if isinstance(val, dict):
                entry = val.copy()
                entry['childKey'] = child_key
                results.append(entry)

        return jsonify({'success': True, 'data': results}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/lesson-plans/submit-daily', methods=['POST'])
def submit_daily_lesson_plan():
    try:
        data = request.get_json() or {}
        teacher_id = data.get('teacherId')
        course_id = data.get('courseId')
        academic_year = data.get('academicYear') or '2025/26'
        key = data.get('key')
        week = data.get('week')
        day_name = data.get('dayName')
        submitted_at = data.get('submittedAt') or datetime.utcnow().isoformat()

        if not teacher_id or not course_id or not key:
            return jsonify({'success': False, 'message': 'teacherId, courseId and key are required'}), 400

        # sanitize child key for RTDB node name
        import re
        child = re.sub(r'[^A-Za-z0-9_\-]', '_', str(key))

        ref = db.reference('LessonPlanSubmissions').child(teacher_id).child(academic_year).child(course_id).child(child)

        existing = ref.get()
        if existing:
            return jsonify({'success': True, 'message': 'Already submitted', 'data': existing}), 200

        obj = {
            'teacherId': teacher_id,
            'courseId': course_id,
            'academicYear': academic_year,
            'key': key,
            'childKey': child,
            'week': week,
            'dayName': day_name,
            'submittedAt': submitted_at
        }

        ref.set(obj)

        return jsonify({'success': True, 'message': 'Submission saved', 'data': obj}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500





# ===================== RUN APP =====================
if __name__ == '__main__':
    app.run(debug=True)
