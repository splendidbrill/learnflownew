$KEY = "c:\Code\learnflownew\learnflow-key.pem"
$SERVER = "ubuntu@107.23.153.140"

Write-Host "Copying files to server..."
scp -i $KEY backend/main.py "${SERVER}:~/learnflownew/backend/main.py"
scp -i $KEY backend/routers/ocr.py "${SERVER}:~/learnflownew/backend/routers/ocr.py"
scp -i $KEY backend/services/glm_ocr_service.py "${SERVER}:~/learnflownew/backend/services/glm_ocr_service.py"
scp -i $KEY backend/.env "${SERVER}:~/learnflownew/backend/.env"
scp -i $KEY frontend/app/dashboard/Sidebar.tsx "${SERVER}:~/learnflownew/frontend/app/dashboard/Sidebar.tsx"

Write-Host "Deploying to Docker containers..."
ssh -i $KEY $SERVER @"
  sudo docker cp ~/learnflownew/backend/main.py learnflow-backend:/app/main.py
  sudo docker cp ~/learnflownew/backend/routers/ocr.py learnflow-backend:/app/routers/ocr.py
  sudo docker cp ~/learnflownew/backend/services/glm_ocr_service.py learnflow-backend:/app/services/glm_ocr_service.py
  sudo docker cp ~/learnflownew/backend/.env learnflow-backend:/app/.env
  sudo docker restart learnflow-backend

  sudo docker exec learnflow-frontend mkdir -p /app/app/dashboard/ocr
  sudo docker cp ~/learnflownew/frontend/app/dashboard/ocr/page.tsx learnflow-frontend:/app/app/dashboard/ocr/page.tsx
  sudo docker cp ~/learnflownew/frontend/app/dashboard/ocr/OCRClient.tsx learnflow-frontend:/app/app/dashboard/ocr/OCRClient.tsx
  sudo docker cp ~/learnflownew/frontend/app/dashboard/Sidebar.tsx learnflow-frontend:/app/app/dashboard/Sidebar.tsx
  sudo docker restart learnflow-frontend
"@

Write-Host "Done. Go to /dashboard/ocr"
