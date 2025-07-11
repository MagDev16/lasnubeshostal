#!/usr/bin/env python3
"""
Las Nubes Hostal Backend API Test Suite
Tests all backend API endpoints for the hostel booking system
"""

import requests
import json
from datetime import datetime, date, timedelta
import uuid
import time

# Configuration
BACKEND_URL = "https://ac022f84-1ab3-4446-867c-93225bf1dbf5.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class HostelAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        self.booking_id = None
        self.session_id = None
        
    def log_test(self, test_name, success, details="", error=""):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "error": error,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if error:
            print(f"   Error: {error}")
        print()

    def test_root_endpoint(self):
        """Test API root endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/")
            if response.status_code == 404:
                # API root might not exist, try the main backend root
                response = self.session.get(f"{BACKEND_URL}/")
                if response.status_code == 200:
                    # This returns HTML (frontend), which is expected
                    self.log_test("Root Endpoint", True, "Frontend served correctly at root")
                else:
                    self.log_test("Root Endpoint", False, f"Status: {response.status_code}", response.text)
            elif response.status_code == 200:
                try:
                    data = response.json()
                    self.log_test("Root Endpoint", True, f"API Root: {data.get('message', 'No message')}")
                except:
                    self.log_test("Root Endpoint", True, "API root accessible")
            else:
                self.log_test("Root Endpoint", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Root Endpoint", False, error=str(e))

    def test_get_all_rooms(self):
        """Test GET /api/rooms - Get all room types"""
        try:
            response = self.session.get(f"{API_BASE}/rooms")
            if response.status_code == 200:
                data = response.json()
                rooms = data.get('rooms', {})
                expected_rooms = ['big_room', 'mid_room', 'shared_room']
                
                if all(room in rooms for room in expected_rooms):
                    room_details = []
                    for room_type, details in rooms.items():
                        room_details.append(f"{room_type}: ${details['price']}/night, capacity: {details['capacity']}")
                    self.log_test("Get All Rooms", True, f"Found {len(rooms)} rooms: {', '.join(room_details)}")
                else:
                    self.log_test("Get All Rooms", False, f"Missing expected room types. Found: {list(rooms.keys())}")
            else:
                self.log_test("Get All Rooms", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get All Rooms", False, error=str(e))

    def test_get_specific_rooms(self):
        """Test GET /api/rooms/{room_type} for each room type"""
        room_types = ['big_room', 'mid_room', 'shared_room']
        
        for room_type in room_types:
            try:
                response = self.session.get(f"{API_BASE}/rooms/{room_type}")
                if response.status_code == 200:
                    data = response.json()
                    room = data.get('room', {})
                    if 'name' in room and 'price' in room and 'capacity' in room:
                        self.log_test(f"Get {room_type} Details", True, 
                                    f"Name: {room['name']}, Price: ${room['price']}, Capacity: {room['capacity']}")
                    else:
                        self.log_test(f"Get {room_type} Details", False, "Missing required room fields")
                else:
                    self.log_test(f"Get {room_type} Details", False, f"Status: {response.status_code}", response.text)
            except Exception as e:
                self.log_test(f"Get {room_type} Details", False, error=str(e))

    def test_invalid_room_type(self):
        """Test GET /api/rooms/{invalid_room_type}"""
        try:
            response = self.session.get(f"{API_BASE}/rooms/invalid_room")
            if response.status_code == 404:
                self.log_test("Invalid Room Type", True, "Correctly returned 404 for invalid room type")
            else:
                self.log_test("Invalid Room Type", False, f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_test("Invalid Room Type", False, error=str(e))

    def test_create_booking_valid(self):
        """Test POST /api/bookings with valid data"""
        try:
            # Create booking for tomorrow to next week
            check_in = date.today() + timedelta(days=1)
            check_out = check_in + timedelta(days=3)
            
            booking_data = {
                "guest_name": "Maria Rodriguez",
                "guest_email": "maria.rodriguez@email.com",
                "guest_phone": "+507-6789-1234",
                "room_type": "mid_room",
                "check_in": check_in.isoformat(),
                "check_out": check_out.isoformat(),
                "guests": 2,
                "special_requests": "Mountain view room if available"
            }
            
            response = self.session.post(f"{API_BASE}/bookings", json=booking_data)
            if response.status_code == 200:
                data = response.json()
                if 'booking_id' in data and 'total_price' in data:
                    self.booking_id = data['booking_id']  # Store for later tests
                    self.log_test("Create Valid Booking", True, 
                                f"Booking ID: {data['booking_id']}, Total: ${data['total_price']}, Status: {data['status']}")
                else:
                    self.log_test("Create Valid Booking", False, "Missing required booking fields in response")
            else:
                self.log_test("Create Valid Booking", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Create Valid Booking", False, error=str(e))

    def test_create_booking_invalid_data(self):
        """Test POST /api/bookings with various invalid data"""
        
        # Test invalid room type
        try:
            invalid_booking = {
                "guest_name": "Carlos Mendez",
                "guest_email": "carlos@email.com",
                "guest_phone": "+507-1234-5678",
                "room_type": "luxury_suite",  # Invalid room type
                "check_in": (date.today() + timedelta(days=1)).isoformat(),
                "check_out": (date.today() + timedelta(days=3)).isoformat(),
                "guests": 2
            }
            
            response = self.session.post(f"{API_BASE}/bookings", json=invalid_booking)
            if response.status_code == 400:
                self.log_test("Invalid Room Type Booking", True, "Correctly rejected invalid room type")
            else:
                self.log_test("Invalid Room Type Booking", False, f"Expected 400, got {response.status_code}")
        except Exception as e:
            self.log_test("Invalid Room Type Booking", False, error=str(e))

        # Test past check-in date
        try:
            past_booking = {
                "guest_name": "Ana Silva",
                "guest_email": "ana@email.com",
                "guest_phone": "+507-9876-5432",
                "room_type": "shared_room",
                "check_in": (date.today() - timedelta(days=1)).isoformat(),  # Past date
                "check_out": (date.today() + timedelta(days=2)).isoformat(),
                "guests": 1
            }
            
            response = self.session.post(f"{API_BASE}/bookings", json=past_booking)
            if response.status_code == 400:
                self.log_test("Past Check-in Date", True, "Correctly rejected past check-in date")
            else:
                self.log_test("Past Check-in Date", False, f"Expected 400, got {response.status_code}")
        except Exception as e:
            self.log_test("Past Check-in Date", False, error=str(e))

        # Test check-out before check-in
        try:
            invalid_dates = {
                "guest_name": "Pedro Gonzalez",
                "guest_email": "pedro@email.com",
                "guest_phone": "+507-5555-1234",
                "room_type": "big_room",
                "check_in": (date.today() + timedelta(days=5)).isoformat(),
                "check_out": (date.today() + timedelta(days=3)).isoformat(),  # Before check-in
                "guests": 2
            }
            
            response = self.session.post(f"{API_BASE}/bookings", json=invalid_dates)
            if response.status_code == 400:
                self.log_test("Invalid Date Range", True, "Correctly rejected invalid date range")
            else:
                self.log_test("Invalid Date Range", False, f"Expected 400, got {response.status_code}")
        except Exception as e:
            self.log_test("Invalid Date Range", False, error=str(e))

    def test_get_booking_details(self):
        """Test GET /api/bookings/{booking_id}"""
        if not self.booking_id:
            self.log_test("Get Booking Details", False, "No booking ID available from previous test")
            return
            
        try:
            response = self.session.get(f"{API_BASE}/bookings/{self.booking_id}")
            if response.status_code == 200:
                data = response.json()
                if 'booking_id' in data and 'guest_name' in data:
                    self.log_test("Get Booking Details", True, 
                                f"Retrieved booking for {data['guest_name']}, Status: {data.get('status', 'unknown')}")
                else:
                    self.log_test("Get Booking Details", False, "Missing required booking fields")
            else:
                self.log_test("Get Booking Details", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get Booking Details", False, error=str(e))

    def test_get_nonexistent_booking(self):
        """Test GET /api/bookings/{invalid_booking_id}"""
        try:
            fake_id = str(uuid.uuid4())
            response = self.session.get(f"{API_BASE}/bookings/{fake_id}")
            if response.status_code == 404:
                self.log_test("Get Nonexistent Booking", True, "Correctly returned 404 for invalid booking ID")
            else:
                self.log_test("Get Nonexistent Booking", False, f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_test("Get Nonexistent Booking", False, error=str(e))

    def test_payment_checkout_session(self):
        """Test POST /api/payments/v1/checkout/session"""
        if not self.booking_id:
            self.log_test("Payment Checkout Session", False, "No booking ID available for payment test")
            return
            
        try:
            payment_data = {
                "booking_id": self.booking_id,
                "origin_url": "https://lasnubeshostal.com"
            }
            
            response = self.session.post(f"{API_BASE}/payments/v1/checkout/session", json=payment_data)
            
            # Since we don't have a real Stripe API key, we expect this to fail gracefully
            if response.status_code == 500:
                error_data = response.json()
                if "Payment processing not available" in error_data.get('detail', ''):
                    self.log_test("Payment Checkout Session", True, 
                                "Correctly handled missing Stripe API key with proper error message")
                else:
                    self.log_test("Payment Checkout Session", False, 
                                f"Unexpected error message: {error_data.get('detail', 'Unknown error')}")
            elif response.status_code == 200:
                # If it somehow works (maybe with test key), that's also fine
                data = response.json()
                if 'checkout_url' in data and 'session_id' in data:
                    self.session_id = data['session_id']
                    self.log_test("Payment Checkout Session", True, 
                                f"Created checkout session: {data['session_id']}")
                else:
                    self.log_test("Payment Checkout Session", False, "Missing required payment fields")
            else:
                self.log_test("Payment Checkout Session", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Payment Checkout Session", False, error=str(e))

    def test_payment_status_check(self):
        """Test GET /api/payments/v1/checkout/status/{session_id}"""
        # Test with a fake session ID since we likely don't have real Stripe integration
        try:
            fake_session_id = "cs_test_" + str(uuid.uuid4())[:8]
            response = self.session.get(f"{API_BASE}/payments/v1/checkout/status/{fake_session_id}")
            
            # Expect this to fail gracefully due to missing Stripe API key
            if response.status_code == 500:
                error_data = response.json()
                if "Payment processing not available" in error_data.get('detail', ''):
                    self.log_test("Payment Status Check", True, 
                                "Correctly handled missing Stripe API key for status check")
                else:
                    self.log_test("Payment Status Check", False, 
                                f"Unexpected error: {error_data.get('detail', 'Unknown error')}")
            elif response.status_code == 404:
                self.log_test("Payment Status Check", True, 
                            "Correctly returned 404 for nonexistent session")
            else:
                self.log_test("Payment Status Check", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Payment Status Check", False, error=str(e))

    def test_contact_form(self):
        """Test POST /api/contact"""
        try:
            contact_data = {
                "name": "Isabella Morales",
                "email": "isabella.morales@email.com",
                "phone": "+507-7777-8888",
                "message": "Hola! I'm interested in booking a room for next month. Do you have availability for a mid-size room from March 15-20? Also, is breakfast included? Gracias!"
            }
            
            response = self.session.post(f"{API_BASE}/contact", json=contact_data)
            if response.status_code == 200:
                data = response.json()
                if 'message' in data and 'message_id' in data:
                    self.log_test("Contact Form Submission", True, 
                                f"Message sent successfully, ID: {data['message_id']}")
                else:
                    self.log_test("Contact Form Submission", False, "Missing required response fields")
            else:
                self.log_test("Contact Form Submission", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Contact Form Submission", False, error=str(e))

    def test_room_availability(self):
        """Test GET /api/availability/{room_type}"""
        room_types = ['big_room', 'mid_room', 'shared_room']
        
        for room_type in room_types:
            try:
                # Check availability for next week
                check_in = date.today() + timedelta(days=7)
                check_out = check_in + timedelta(days=2)
                
                params = {
                    'check_in': check_in.isoformat(),
                    'check_out': check_out.isoformat()
                }
                
                response = self.session.get(f"{API_BASE}/availability/{room_type}", params=params)
                if response.status_code == 200:
                    data = response.json()
                    if 'available' in data and 'price_per_night' in data:
                        availability = "Available" if data['available'] else "Not Available"
                        self.log_test(f"Check {room_type} Availability", True, 
                                    f"{availability}, Price: ${data['price_per_night']}/night")
                    else:
                        self.log_test(f"Check {room_type} Availability", False, "Missing required availability fields")
                else:
                    self.log_test(f"Check {room_type} Availability", False, f"Status: {response.status_code}", response.text)
            except Exception as e:
                self.log_test(f"Check {room_type} Availability", False, error=str(e))

    def test_availability_invalid_room(self):
        """Test availability check for invalid room type"""
        try:
            check_in = date.today() + timedelta(days=1)
            check_out = check_in + timedelta(days=2)
            
            params = {
                'check_in': check_in.isoformat(),
                'check_out': check_out.isoformat()
            }
            
            response = self.session.get(f"{API_BASE}/availability/presidential_suite", params=params)
            if response.status_code == 404:
                self.log_test("Invalid Room Availability", True, "Correctly returned 404 for invalid room type")
            else:
                self.log_test("Invalid Room Availability", False, f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_test("Invalid Room Availability", False, error=str(e))

    def run_all_tests(self):
        """Run all backend API tests"""
        print("=" * 60)
        print("LAS NUBES HOSTAL BACKEND API TEST SUITE")
        print("=" * 60)
        print(f"Testing backend at: {BACKEND_URL}")
        print(f"API base URL: {API_BASE}")
        print("=" * 60)
        print()
        
        # Run all tests
        self.test_root_endpoint()
        self.test_get_all_rooms()
        self.test_get_specific_rooms()
        self.test_invalid_room_type()
        self.test_create_booking_valid()
        self.test_create_booking_invalid_data()
        self.test_get_booking_details()
        self.test_get_nonexistent_booking()
        self.test_payment_checkout_session()
        self.test_payment_status_check()
        self.test_contact_form()
        self.test_room_availability()
        self.test_availability_invalid_room()
        
        # Summary
        print("=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['success'])
        failed = len(self.test_results) - passed
        
        print(f"Total Tests: {len(self.test_results)}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/len(self.test_results)*100):.1f}%")
        print()
        
        if failed > 0:
            print("FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"❌ {result['test']}: {result['error']}")
            print()
        
        print("CRITICAL ISSUES:")
        critical_failures = []
        for result in self.test_results:
            if not result['success']:
                # Identify critical vs minor issues
                if any(keyword in result['test'].lower() for keyword in ['booking', 'room', 'database', 'api']):
                    if 'payment processing not available' not in result['error'].lower():
                        critical_failures.append(result['test'])
        
        if critical_failures:
            for failure in critical_failures:
                print(f"🚨 {failure}")
        else:
            print("✅ No critical issues found!")
        
        return passed, failed, critical_failures

if __name__ == "__main__":
    tester = HostelAPITester()
    passed, failed, critical_failures = tester.run_all_tests()
    
    # Exit with appropriate code
    if critical_failures:
        exit(1)  # Critical failures
    elif failed > 0:
        exit(2)  # Minor failures only
    else:
        exit(0)  # All tests passed