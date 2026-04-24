from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from datetime import datetime, date
import os
import uuid
import uvicorn
from pymongo import MongoClient
from bson import ObjectId
import json
from dotenv import load_dotenv

load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="Las Nubes Hostal API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
try:
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    client.server_info()
    db = client['las_nubes_hostal']
    print("MongoDB connected successfully")
except Exception as e:
    print(f"MongoDB connection failed: {e}")
    client = None
    db = None

# Collections
bookings_collection = db['bookings'] if db is not None else None
payment_transactions_collection = db['payment_transactions'] if db is not None else None

# Initialize Stripe (will be ready when API key is provided)
stripe_checkout = None
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')

if STRIPE_API_KEY:
    try:
        import emergentintegrations
        from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY)
        print("Stripe integration initialized successfully")
    except ImportError:
        print("Stripe integration not available - emergentintegrations not installed")
else:
    print("Stripe API key not provided - payment processing disabled")

# Room types and pricing
ROOM_TYPES = {
    "big_room": {
        "name": "Big Room",
        "description": "Spacious room with queen bed and private bathroom",
        "price": 45.00,
        "capacity": 2,
        "amenities": ["Queen bed", "Private bathroom", "Mountain view", "WiFi"]
    },
    "mid_room": {
        "name": "Mid-Size Room", 
        "description": "Comfortable room with private bathroom",
        "price": 35.00,
        "capacity": 2,
        "amenities": ["Double bed", "Private bathroom", "WiFi"]
    },
    "shared_room": {
        "name": "Shared Room",
        "description": "Budget-friendly shared room with 2 bunk beds",
        "price": 20.00,
        "capacity": 4,
        "amenities": ["2 bunk beds", "Shared bathroom", "WiFi"]
    }
}

# Pydantic models
class BookingRequest(BaseModel):
    guest_name: str = Field(..., description="Guest's full name")
    guest_email: str = Field(..., description="Guest's email address")
    guest_phone: str = Field(..., description="Guest's phone number")
    room_type: str = Field(..., description="Type of room to book")
    check_in: date = Field(..., description="Check-in date")
    check_out: date = Field(..., description="Check-out date")
    guests: int = Field(..., description="Number of guests")
    special_requests: Optional[str] = Field(None, description="Special requests or notes")

class BookingResponse(BaseModel):
    booking_id: str
    guest_name: str
    room_type: str
    check_in: date
    check_out: date
    guests: int
    total_price: float
    status: str
    created_at: datetime

class PaymentRequest(BaseModel):
    booking_id: str
    origin_url: str

class PaymentResponse(BaseModel):
    checkout_url: str
    session_id: str
    booking_id: str

class ContactMessage(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    message: str

# Utility functions
def calculate_total_price(room_type: str, check_in: date, check_out: date) -> float:
    """Calculate total price for booking"""
    if room_type not in ROOM_TYPES:
        raise ValueError("Invalid room type")
    
    nights = (check_out - check_in).days
    if nights <= 0:
        raise ValueError("Check-out date must be after check-in date")
    
    price_per_night = ROOM_TYPES[room_type]["price"]
    return float(nights * price_per_night)

def serialize_document(doc):
    """Convert MongoDB document to JSON serializable format"""
    if isinstance(doc, dict):
        for key, value in doc.items():
            if isinstance(value, ObjectId):
                doc[key] = str(value)
            elif isinstance(value, datetime):
                doc[key] = value.isoformat()
            elif isinstance(value, date):
                doc[key] = value.isoformat()
    return doc

# API Routes
@app.get("/")
async def root():
    return {"message": "Las Nubes Hostal API - Welcome to Paradise in the Mountains!"}

@app.get("/api/rooms")
async def get_rooms():
    """Get all available room types"""
    return {"rooms": ROOM_TYPES}

@app.get("/api/rooms/{room_type}")
async def get_room_details(room_type: str):
    """Get details for a specific room type"""
    if room_type not in ROOM_TYPES:
        raise HTTPException(status_code=404, detail="Room type not found")
    return {"room": ROOM_TYPES[room_type]}

@app.post("/api/bookings")
async def create_booking(booking: BookingRequest):
    """Create a new booking"""
    if bookings_collection is None:
        raise HTTPException(status_code=503, detail="Database not available. Please configure MONGO_URL.")
    try:
        # Validate room type
        if booking.room_type not in ROOM_TYPES:
            raise HTTPException(status_code=400, detail="Invalid room type")
        
        # Validate dates
        if booking.check_in >= booking.check_out:
            raise HTTPException(status_code=400, detail="Check-out date must be after check-in date")
        
        if booking.check_in < date.today():
            raise HTTPException(status_code=400, detail="Check-in date cannot be in the past")
        
        # Validate guest count
        max_capacity = ROOM_TYPES[booking.room_type]["capacity"]
        if booking.guests > max_capacity:
            raise HTTPException(status_code=400, detail=f"Room capacity exceeded. Maximum guests: {max_capacity}")
        
        # Calculate total price
        total_price = calculate_total_price(booking.room_type, booking.check_in, booking.check_out)
        
        # Create booking document
        booking_doc = {
            "booking_id": str(uuid.uuid4()),
            "guest_name": booking.guest_name,
            "guest_email": booking.guest_email,
            "guest_phone": booking.guest_phone,
            "room_type": booking.room_type,
            "check_in": booking.check_in.isoformat(),
            "check_out": booking.check_out.isoformat(),
            "guests": booking.guests,
            "special_requests": booking.special_requests,
            "total_price": total_price,
            "status": "pending_payment",
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        
        # Save to database
        result = bookings_collection.insert_one(booking_doc)
        
        # Return booking details
        return BookingResponse(
            booking_id=booking_doc["booking_id"],
            guest_name=booking_doc["guest_name"],
            room_type=booking_doc["room_type"],
            check_in=booking_doc["check_in"],
            check_out=booking_doc["check_out"],
            guests=booking_doc["guests"],
            total_price=booking_doc["total_price"],
            status=booking_doc["status"],
            created_at=booking_doc["created_at"]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating booking: {str(e)}")

@app.get("/api/bookings/{booking_id}")
async def get_booking(booking_id: str):
    """Get booking details"""
    booking = bookings_collection.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    return serialize_document(booking)

@app.post("/api/payments/v1/checkout/session")
async def create_checkout_session(payment: PaymentRequest):
    """Create Stripe checkout session for booking payment"""
    if not stripe_checkout:
        raise HTTPException(status_code=500, detail="Payment processing not available. Please contact support.")
    
    try:
        # Get booking details
        booking = bookings_collection.find_one({"booking_id": payment.booking_id})
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        if booking["status"] != "pending_payment":
            raise HTTPException(status_code=400, detail="Booking is not pending payment")
        
        # Create checkout session
        success_url = f"{payment.origin_url}/booking-success?session_id={{CHECKOUT_SESSION_ID}}&booking_id={payment.booking_id}"
        cancel_url = f"{payment.origin_url}/booking-cancel?booking_id={payment.booking_id}"
        
        checkout_request = CheckoutSessionRequest(
            amount=booking["total_price"],
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "booking_id": payment.booking_id,
                "guest_name": booking["guest_name"],
                "room_type": booking["room_type"],
                "source": "hostel_booking"
            }
        )
        
        session = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Create payment transaction record
        payment_doc = {
            "transaction_id": str(uuid.uuid4()),
            "booking_id": payment.booking_id,
            "session_id": session.session_id,
            "amount": booking["total_price"],
            "currency": "usd",
            "payment_status": "pending",
            "status": "initiated",
            "metadata": {
                "booking_id": payment.booking_id,
                "guest_name": booking["guest_name"],
                "room_type": booking["room_type"],
                "source": "hostel_booking"
            },
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        
        payment_transactions_collection.insert_one(payment_doc)
        
        return PaymentResponse(
            checkout_url=session.url,
            session_id=session.session_id,
            booking_id=payment.booking_id
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating checkout session: {str(e)}")

@app.get("/api/payments/v1/checkout/status/{session_id}")
async def get_checkout_status(session_id: str):
    """Get checkout session status and update payment record"""
    if not stripe_checkout:
        raise HTTPException(status_code=500, detail="Payment processing not available")
    
    try:
        # Get payment transaction
        payment_transaction = payment_transactions_collection.find_one({"session_id": session_id})
        if not payment_transaction:
            raise HTTPException(status_code=404, detail="Payment transaction not found")
        
        # Get status from Stripe
        checkout_status = await stripe_checkout.get_checkout_status(session_id)
        
        # Update payment transaction if status changed
        if payment_transaction["payment_status"] != checkout_status.payment_status:
            payment_transactions_collection.update_one(
                {"session_id": session_id},
                {
                    "$set": {
                        "payment_status": checkout_status.payment_status,
                        "status": checkout_status.status,
                        "updated_at": datetime.now()
                    }
                }
            )
            
            # Update booking status if payment successful
            if checkout_status.payment_status == "paid":
                bookings_collection.update_one(
                    {"booking_id": payment_transaction["booking_id"]},
                    {
                        "$set": {
                            "status": "confirmed",
                            "payment_session_id": session_id,
                            "updated_at": datetime.now()
                        }
                    }
                )
        
        return {
            "status": checkout_status.status,
            "payment_status": checkout_status.payment_status,
            "amount_total": checkout_status.amount_total,
            "currency": checkout_status.currency,
            "metadata": checkout_status.metadata,
            "booking_id": payment_transaction["booking_id"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking payment status: {str(e)}")

@app.post("/api/contact")
async def send_contact_message(message: ContactMessage):
    """Handle contact form submissions"""
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available. Please configure MONGO_URL.")
    try:
        contact_doc = {
            "message_id": str(uuid.uuid4()),
            "name": message.name,
            "email": message.email,
            "phone": message.phone,
            "message": message.message,
            "status": "new",
            "created_at": datetime.now()
        }

        db['contact_messages'].insert_one(contact_doc)
        
        return {"message": "Message sent successfully", "message_id": contact_doc["message_id"]}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending message: {str(e)}")

@app.get("/api/availability/{room_type}")
async def check_room_availability(room_type: str, check_in: date, check_out: date):
    """Check room availability for given dates"""
    if room_type not in ROOM_TYPES:
        raise HTTPException(status_code=404, detail="Room type not found")
    
    # Check for overlapping bookings
    overlapping_bookings = bookings_collection.find({
        "room_type": room_type,
        "status": {"$in": ["confirmed", "pending_payment"]},
        "$or": [
            {"check_in": {"$lte": check_in.isoformat()}, "check_out": {"$gt": check_in.isoformat()}},
            {"check_in": {"$lt": check_out.isoformat()}, "check_out": {"$gte": check_out.isoformat()}},
            {"check_in": {"$gte": check_in.isoformat()}, "check_out": {"$lte": check_out.isoformat()}}
        ]
    })
    
    booking_count = bookings_collection.count_documents({
        "room_type": room_type,
        "status": {"$in": ["confirmed", "pending_payment"]},
        "$or": [
            {"check_in": {"$lte": check_in.isoformat()}, "check_out": {"$gt": check_in.isoformat()}},
            {"check_in": {"$lt": check_out.isoformat()}, "check_out": {"$gte": check_out.isoformat()}},
            {"check_in": {"$gte": check_in.isoformat()}, "check_out": {"$lte": check_out.isoformat()}}
        ]
    })
    
    # For simplicity, assume 1 room per type (can be extended for multiple rooms)
    available = booking_count == 0
    
    return {
        "room_type": room_type,
        "check_in": check_in.isoformat(),
        "check_out": check_out.isoformat(),
        "available": available,
        "price_per_night": ROOM_TYPES[room_type]["price"]
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)