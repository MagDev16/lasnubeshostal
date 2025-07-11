import React, { useState, useEffect } from 'react';
import './App.css';

const App = () => {
  const [currentSection, setCurrentSection] = useState('home');
  const [bookingData, setBookingData] = useState({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    room_type: '',
    check_in: '',
    check_out: '',
    guests: 1,
    special_requests: ''
  });
  const [contactData, setContactData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [rooms, setRooms] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

  useEffect(() => {
    fetchRooms();
    checkBookingStatus();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/rooms`);
      const data = await response.json();
      setRooms(data.rooms);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  const checkBookingStatus = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const bookingId = urlParams.get('booking_id');
    
    if (sessionId) {
      pollPaymentStatus(sessionId, bookingId);
    }
  };

  const pollPaymentStatus = async (sessionId, bookingId, attempts = 0) => {
    const maxAttempts = 5;
    
    if (attempts >= maxAttempts) {
      setMessage('Payment status check timed out. Please contact us for confirmation.');
      return;
    }

    try {
      const response = await fetch(`${backendUrl}/api/payments/v1/checkout/status/${sessionId}`);
      const data = await response.json();
      
      if (data.payment_status === 'paid') {
        setMessage('¡Booking confirmed! Thank you for choosing Las Nubes Hostal. You will receive a confirmation email shortly.');
        setCurrentSection('booking-success');
        return;
      } else if (data.status === 'expired') {
        setMessage('Payment session expired. Please try booking again.');
        return;
      }

      setTimeout(() => pollPaymentStatus(sessionId, bookingId, attempts + 1), 2000);
    } catch (error) {
      console.error('Error checking payment status:', error);
      setMessage('Error checking payment status. Please contact us for assistance.');
    }
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Create booking
      const bookingResponse = await fetch(`${backendUrl}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData),
      });

      if (!bookingResponse.ok) {
        const errorData = await bookingResponse.json();
        throw new Error(errorData.detail || 'Failed to create booking');
      }

      const booking = await bookingResponse.json();

      // Create payment session
      const paymentResponse = await fetch(`${backendUrl}/api/payments/v1/checkout/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          booking_id: booking.booking_id,
          origin_url: window.location.origin
        }),
      });

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json();
        throw new Error(errorData.detail || 'Failed to create payment session');
      }

      const paymentData = await paymentResponse.json();
      
      // Redirect to Stripe Checkout
      window.location.href = paymentData.checkout_url;

    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${backendUrl}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactData),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      setMessage('Message sent successfully! We will get back to you soon.');
      setContactData({ name: '', email: '', phone: '', message: '' });
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const NavBar = () => (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-logo">
          <h2>Las Nubes Hostal</h2>
        </div>
        <ul className="nav-menu">
          <li onClick={() => setCurrentSection('home')}>Home</li>
          <li onClick={() => setCurrentSection('rooms')}>Rooms</li>
          <li onClick={() => setCurrentSection('booking')}>Book Now</li>
          <li onClick={() => setCurrentSection('about')}>About</li>
          <li onClick={() => setCurrentSection('contact')}>Contact</li>
        </ul>
      </div>
    </nav>
  );

  const HomePage = () => (
    <section className="hero-section">
      <div className="hero-content">
        <div className="hero-text">
          <h1>Las Nubes Hostal</h1>
          <p className="hero-subtitle">Un refugio en las alturas</p>
          <p className="hero-description">
            Experience breathtaking views of Volcán Barú and the charming town of Cerro Punta. 
            Our cozy hostel offers comfortable accommodations with all the amenities you need 
            for an unforgettable mountain getaway.
          </p>
          <div className="hero-features">
            <div className="feature-item">
              <span className="feature-icon">🏔️</span>
              <span>Mountain Views</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🔥</span>
              <span>Cozy Fireplace</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🍳</span>
              <span>Equipped Kitchen</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🐕</span>
              <span>Pet Friendly</span>
            </div>
          </div>
          <button 
            className="cta-button"
            onClick={() => setCurrentSection('booking')}
          >
            Book Your Stay
          </button>
        </div>
        <div className="hero-image">
          <img 
            src="https://images.unsplash.com/photo-1602436324859-62a81466e723?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwxfHxtb3VudGFpbiUyMGhvc3RlbHxlbnwwfHx8fDE3NTIyMTY0MjZ8MA&ixlib=rb-4.1.0&q=85"
            alt="Las Nubes Hostal mountain view"
          />
        </div>
      </div>
    </section>
  );

  const RoomsPage = () => (
    <section className="rooms-section">
      <div className="container">
        <h2>Our Accommodations</h2>
        <p className="section-description">
          Choose from our comfortable rooms, each designed to provide you with the perfect mountain retreat.
        </p>
        <div className="rooms-grid">
          {Object.entries(rooms).map(([key, room]) => (
            <div key={key} className="room-card">
              <div className="room-image">
                <img 
                  src={key === 'big_room' ? 
                    "https://images.unsplash.com/photo-1744471868062-17a54faa3cf5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDF8MHwxfHNlYXJjaHwyfHxjb3p5JTIwYWNjb21tb2RhdGlvbnxlbnwwfHx8fDE3NTIyMTY0MzR8MA&ixlib=rb-4.1.0&q=85" :
                    key === 'mid_room' ? 
                    "https://images.unsplash.com/photo-1562323150-c3f486a6f185?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwzfHxtb3VudGFpbiUyMGhvc3RlbHxlbnwwfHx8fDE3NTIyMTY0MjZ8MA&ixlib=rb-4.1.0&q=85" :
                    "https://images.pexels.com/photos/18904093/pexels-photo-18904093.jpeg"
                  }
                  alt={room.name}
                />
              </div>
              <div className="room-info">
                <h3>{room.name}</h3>
                <p className="room-description">{room.description}</p>
                <div className="room-price">{formatPrice(room.price)} / night</div>
                <div className="room-capacity">Up to {room.capacity} guests</div>
                <div className="room-amenities">
                  <h4>Amenities:</h4>
                  <ul>
                    {room.amenities.map((amenity, index) => (
                      <li key={index}>{amenity}</li>
                    ))}
                  </ul>
                </div>
                <button 
                  className="book-room-btn"
                  onClick={() => {
                    setBookingData(prev => ({...prev, room_type: key}));
                    setCurrentSection('booking');
                  }}
                >
                  Book This Room
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  const BookingPage = () => (
    <section className="booking-section">
      <div className="container">
        <h2>Book Your Stay</h2>
        <p className="section-description">
          Reserve your perfect mountain getaway at Las Nubes Hostal. Fill out the form below to secure your booking.
        </p>
        
        {message && (
          <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleBookingSubmit} className="booking-form">
          <div className="form-row">
            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                required
                value={bookingData.guest_name}
                onChange={(e) => setBookingData(prev => ({...prev, guest_name: e.target.value}))}
                placeholder="Enter your full name"
              />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                required
                value={bookingData.guest_email}
                onChange={(e) => setBookingData(prev => ({...prev, guest_email: e.target.value}))}
                placeholder="Enter your email"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Phone Number *</label>
              <input
                type="tel"
                required
                value={bookingData.guest_phone}
                onChange={(e) => setBookingData(prev => ({...prev, guest_phone: e.target.value}))}
                placeholder="Enter your phone number"
              />
            </div>
            <div className="form-group">
              <label>Room Type *</label>
              <select
                required
                value={bookingData.room_type}
                onChange={(e) => setBookingData(prev => ({...prev, room_type: e.target.value}))}
              >
                <option value="">Select a room</option>
                {Object.entries(rooms).map(([key, room]) => (
                  <option key={key} value={key}>
                    {room.name} - {formatPrice(room.price)}/night
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Check-in Date *</label>
              <input
                type="date"
                required
                value={bookingData.check_in}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setBookingData(prev => ({...prev, check_in: e.target.value}))}
              />
            </div>
            <div className="form-group">
              <label>Check-out Date *</label>
              <input
                type="date"
                required
                value={bookingData.check_out}
                min={bookingData.check_in || new Date().toISOString().split('T')[0]}
                onChange={(e) => setBookingData(prev => ({...prev, check_out: e.target.value}))}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Number of Guests *</label>
              <select
                required
                value={bookingData.guests}
                onChange={(e) => setBookingData(prev => ({...prev, guests: parseInt(e.target.value)}))}
              >
                <option value={1}>1 Guest</option>
                <option value={2}>2 Guests</option>
                <option value={3}>3 Guests</option>
                <option value={4}>4 Guests</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Special Requests</label>
            <textarea
              value={bookingData.special_requests}
              onChange={(e) => setBookingData(prev => ({...prev, special_requests: e.target.value}))}
              placeholder="Any special requests or additional information..."
              rows="4"
            />
          </div>

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Processing...' : 'Proceed to Payment'}
          </button>
        </form>
      </div>
    </section>
  );

  const AboutPage = () => (
    <section className="about-section">
      <div className="container">
        <h2>About Las Nubes Hostal</h2>
        <div className="about-content">
          <div className="about-text">
            <p>
              Nestled in the breathtaking mountains of Cerro Punta, Chiriquí, Panama, Las Nubes Hostal 
              offers a unique mountain retreat experience. Our hostel is perfectly positioned to provide 
              stunning views of the majestic Volcán Barú and the charming town of Cerro Punta below.
            </p>
            <p>
              At Las Nubes Hostal, we believe in creating memorable experiences for our guests. 
              Whether you're seeking adventure, relaxation, or simply want to disconnect from the 
              hustle and bustle of city life, our hostel provides the perfect sanctuary.
            </p>
            
            <div className="features-grid">
              <div className="feature">
                <h3>🏔️ Spectacular Views</h3>
                <p>Wake up to breathtaking views of Volcán Barú and the picturesque Cerro Punta valley.</p>
              </div>
              <div className="feature">
                <h3>🔥 Cozy Fireplace</h3>
                <p>Gather around our warm fireplace during cool mountain evenings.</p>
              </div>
              <div className="feature">
                <h3>🍳 Equipped Kitchen</h3>
                <p>Prepare your own meals in our fully equipped communal kitchen.</p>
              </div>
              <div className="feature">
                <h3>📶 Free WiFi</h3>
                <p>Stay connected with complimentary high-speed internet throughout the property.</p>
              </div>
              <div className="feature">
                <h3>🚗 Free Parking</h3>
                <p>Secure parking available for all guests at no additional cost.</p>
              </div>
              <div className="feature">
                <h3>🐕 Pet Friendly</h3>
                <p>Bring your furry friends along for the mountain adventure!</p>
              </div>
            </div>
          </div>
          <div className="about-image">
            <img 
              src="https://images.pexels.com/photos/32895225/pexels-photo-32895225.jpeg"
              alt="Las Nubes Hostal interior"
            />
          </div>
        </div>
      </div>
    </section>
  );

  const ContactPage = () => (
    <section className="contact-section">
      <div className="container">
        <h2>Contact Us</h2>
        <p className="section-description">
          Get in touch with us for bookings, questions, or more information about Las Nubes Hostal.
        </p>
        
        <div className="contact-content">
          <div className="contact-info">
            <h3>Get in Touch</h3>
            <div className="contact-item">
              <strong>📍 Address:</strong>
              <p>El Alto las Nubes, Cerro Punta<br />Chiriquí, Panamá</p>
            </div>
            <div className="contact-item">
              <strong>📞 Phone:</strong>
              <p>+507 6810-9090</p>
            </div>
            <div className="contact-item">
              <strong>✉️ Email:</strong>
              <p>lasnubeshostalinfo@gmail.com</p>
            </div>
            <div className="contact-item">
              <strong>📱 Instagram:</strong>
              <p>@lasnubeshostal</p>
            </div>
          </div>

          <div className="contact-form-container">
            <h3>Send us a Message</h3>
            {message && (
              <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
                {message}
              </div>
            )}
            <form onSubmit={handleContactSubmit} className="contact-form">
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  required
                  value={contactData.name}
                  onChange={(e) => setContactData(prev => ({...prev, name: e.target.value}))}
                  placeholder="Your full name"
                />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  required
                  value={contactData.email}
                  onChange={(e) => setContactData(prev => ({...prev, email: e.target.value}))}
                  placeholder="Your email address"
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  value={contactData.phone}
                  onChange={(e) => setContactData(prev => ({...prev, phone: e.target.value}))}
                  placeholder="Your phone number"
                />
              </div>
              <div className="form-group">
                <label>Message *</label>
                <textarea
                  required
                  value={contactData.message}
                  onChange={(e) => setContactData(prev => ({...prev, message: e.target.value}))}
                  placeholder="Tell us how we can help you..."
                  rows="5"
                />
              </div>
              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );

  const BookingSuccessPage = () => (
    <section className="booking-success-section">
      <div className="container">
        <div className="success-content">
          <h2>🎉 Booking Confirmed!</h2>
          <p>Thank you for choosing Las Nubes Hostal!</p>
          <p>
            Your booking has been successfully confirmed. You will receive a confirmation email 
            with all the details shortly.
          </p>
          <p>
            We look forward to welcoming you to our mountain paradise and providing you with 
            an unforgettable experience.
          </p>
          <button 
            className="cta-button"
            onClick={() => setCurrentSection('home')}
          >
            Return to Home
          </button>
        </div>
      </div>
    </section>
  );

  const renderCurrentSection = () => {
    switch(currentSection) {
      case 'home':
        return <HomePage />;
      case 'rooms':
        return <RoomsPage />;
      case 'booking':
        return <BookingPage />;
      case 'about':
        return <AboutPage />;
      case 'contact':
        return <ContactPage />;
      case 'booking-success':
        return <BookingSuccessPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="App">
      <NavBar />
      {renderCurrentSection()}
    </div>
  );
};

export default App;