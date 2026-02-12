# Use a slim Python image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all backend files
COPY . .

# Use Gunicorn to run the Flask app
# Replace 'app:app' if your Flask object has a different name
CMD ["gunicorn", "--workers", "2", "--threads", "4", "--bind", "0.0.0.0:$PORT", "app:app"]
