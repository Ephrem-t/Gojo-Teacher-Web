# Correct Posts Node Structure - School_Admin Reference

```
├─ School_Admin
│   ├─ <adminId1>
│   │    ├─ adminId: "admin_001"
│   │    ├─ name: "John Admin"
│   │    ├─ username: "johnadmin"
│   │    ├─ email: "admin@school.com"
│   │    ├─ password: "hashed_password"
│   │    ├─ profileImage: "url"
│   │    └─ isActive: true
│   ├─ <adminId2>
│   └─ ...
│
├─ Posts
│   ├─ <postId1>
│   │    ├─ postId: "post_12345"
│   │    ├─ message: "string"
│   │    ├─ postUrl: "url" | null
│   │    ├─ adminId: "admin_001"        ← References School_Admin adminId
│   │    ├─ adminName: "John Admin"     ← From School_Admin name
│   │    ├─ adminProfile: "url"         ← From School_Admin profileImage
│   │    ├─ time: "ISO_string"
│   │    ├─ likeCount: number
│   │    ├─ likes
│   │    │    ├─ <userId1>: true | false
│   │    │    ├─ <userId2>: true | false
│   │    │    └─ <adminId>: true | false
│   │    └─ seenBy
│   │         ├─ <userId1>: true | false
│   │         ├─ <userId2>: true | false
│   │         └─ <adminId>: true | false
│   ├─ <postId2>
│   └─ ...
│
├─ Users
│   ├─ <userId1>
│   │    ├─ userId: "user_001"
│   │    ├─ username: "student1"
│   │    ├─ name: "Alice Student"
│   │    ├─ profileImage: "url"
│   │    └─ role: "student"
│   └─ ...
│
├─ Teachers
│   ├─ <teacherId1>
│   │    ├─ userId: "teacher_001"
│   │    ├─ name: "Mr. Smith"
│   │    └─ profileImage: "url"
│   └─ ...
│
├─ Students
│   ├─ <studentId1>
│   │    ├─ userId: "user_001"
│   │    ├─ name: "Alice Student"
│   │    ├─ profileImage: "url"
│   │    └─ grade: "10A"
│   └─ ...
│
└─ Parents
    ├─ <parentId1>
    │    ├─ userId: "parent_001"
    │    ├─ name: "Alice's Parent"
    │    ├─ profileImage: "url"
    │    └─ studentId: "user_001"
    └─ ...
```

## How adminId Should Work

### 1. School_Admin Node Structure
```javascript
// School_Admin contains admin-specific data
{
  "School_Admin": {
    "admin_001": {
      "adminId": "admin_001",      // Primary key
      "name": "John Admin",
      "username": "johnadmin", 
      "email": "admin@school.com",
      "password": "hashed_password",
      "profileImage": "https://storage.googleapis.com/profiles/admin.jpg",
      "isActive": true
    }
  }
}
```

### 2. Dashboard.jsx Should Reference School_Admin
```javascript
// Current implementation (incorrect)
const [admin, setAdmin] = useState({
  userId: "admin_001",  // ← This should come from School_Admin
  name: "John Admin",
  username: "johnadmin",
  profileImage: "/default-profile.png",
});

// Should be:
const [admin, setAdmin] = useState({
  adminId: "admin_001",  // ← From School_Admin node
  name: "John Admin",
  username: "johnadmin", 
  profileImage: "https://storage.googleapis.com/profiles/admin.jpg",
});
```

### 3. Post Creation with School_Admin Reference
```javascript
const handlePost = async () => {
  const formData = new FormData();
  formData.append("adminId", admin.adminId);     // ← From School_Admin
  formData.append("adminName", admin.name);      // From School_Admin
  formData.append("adminProfile", admin.profileImage); // From School_Admin
  
  await axios.post("http://127.0.0.1:5000/api/create_post", formData);
};
```

### 4. Firebase Query for School_Admin
```javascript
// Should load from School_Admin node
const loadAdminFromStorage = () => {
  const storedAdmin = localStorage.getItem("admin");
  if (storedAdmin) {
    const adminData = JSON.parse(storedAdmin);
    // Verify this admin exists in School_Admin node
    axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/School_Admin/${adminData.adminId}.json`)
      .then(res => {
        if (res.data) {
          setAdmin(res.data);  // Load from School_Admin node
        }
      });
  }
};
```

## Key Difference

**Current (Wrong):**
- `adminId` = `userId` from Users node
- Admins mixed with regular users

**Correct:**
- `adminId` = `adminId` from School_Admin node  
- Separate admin authentication system
- Clear separation between admins and users

The `adminId` in Posts should reference the `adminId` field in the School_Admin node, not the `userId` from the Users node.
