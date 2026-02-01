from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from services.email_service import send_contact_email

router = APIRouter(tags=["Contact"])

class ContactRequest(BaseModel):
    firstName: str
    lastName: str
    isCustomer: str # "yes" or "no"
    plan: str | None = None
    email: EmailStr
    message: str

@router.post("/contact")
async def submit_contact_form(request: ContactRequest):
    try:
        # Convert pydantic model to dict
        data = request.dict()
        
        # Send email
        success = await send_contact_email(data)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to send email")
            
        return {"status": "success", "message": "Message sent successfully"}
        
    except Exception as e:
        print(f"Contact form error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
