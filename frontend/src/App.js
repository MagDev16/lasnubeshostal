import React, { useState, useEffect } from 'react';
import './App.css';
import translations from './translations';

const App = () => {
  const [lang, setLang] = useState('es');
  const [currentSection, setCurrentSection] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookingData, setBookingData] = useState({
    guest_name: '', guest_email: '', guest_phone: '',
    room_type: '', check_in: '', check_out: '', guests: 1, special_requests: ''
  });
  const [contactData, setContactData] = useState({ name: '', email: '', phone: '', message: '' });
  const [rooms, setRooms] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
  const t = translations[lang];

  useEffect(() => { fetchRooms(); checkBookingStatus(); }, []);

  const fetchRooms = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/rooms`);
      const data = await res.json();
      setRooms(data.rooms);
    } catch (e) { console.error('Error fetching rooms:', e); }
  };

  const checkBookingStatus = () => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const bookingId = params.get('booking_id');
    if (sessionId) pollPaymentStatus(sessionId, bookingId);
  };

  const pollPaymentStatus = async (sessionId, bookingId, attempts = 0) => {
    if (attempts >= 5) { setMessage(t.messages.paymentTimeout); return; }
    try {
      const res = await fetch(`${backendUrl}/api/payments/v1/checkout/status/${sessionId}`);
      const data = await res.json();
      if (data.payment_status === 'paid') {
        setMessage(t.messages.bookingConfirmed);
        setCurrentSection('booking-success');
        return;
      } else if (data.status === 'expired') {
        setMessage(t.messages.paymentExpired); return;
      }
      setTimeout(() => pollPaymentStatus(sessionId, bookingId, attempts + 1), 2000);
    } catch (e) { setMessage(t.messages.paymentError); }
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setMessage('');
    try {
      const bookingRes = await fetch(`${backendUrl}/api/bookings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData),
      });
      if (!bookingRes.ok) { const err = await bookingRes.json(); throw new Error(err.detail || 'Failed to create booking'); }
      const booking = await bookingRes.json();
      const paymentRes = await fetch(`${backendUrl}/api/payments/v1/checkout/session`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: booking.booking_id, origin_url: window.location.origin }),
      });
      if (!paymentRes.ok) { const err = await paymentRes.json(); throw new Error(err.detail || 'Failed to create payment session'); }
      const paymentData = await paymentRes.json();
      window.location.href = paymentData.checkout_url;
    } catch (e) { setMessage(`Error: ${e.message}`); }
    finally { setLoading(false); }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setMessage('');
    try {
      const res = await fetch(`${backendUrl}/api/contact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactData),
      });
      if (!res.ok) throw new Error('Failed to send message');
      setMessage(t.messages.contactSuccess);
      setContactData({ name: '', email: '', phone: '', message: '' });
    } catch (e) { setMessage(`Error: ${e.message}`); }
    finally { setLoading(false); }
  };

  const formatPrice = (price) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);

  const navigate = (section) => { setCurrentSection(section); setMenuOpen(false); };

  const NavBar = () => (
    <>
      <nav className="navbar">
        <div className="nav-container">
          <div className="nav-logo" onClick={() => navigate('home')}>
            <div className="nav-logo-badge">LN</div>
            <div className="nav-logo-text">
              <h2>Las Nubes Hostal</h2>
              <span className="nav-tagline">CERRO PUNTA · PANAMÁ</span>
            </div>
          </div>
          <div className="nav-right">
            <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
              {menuOpen ? '✕' : '☰'}
            </button>
            <ul className="nav-menu">
              {[['home', t.nav.home], ['rooms', t.nav.rooms], ['booking', t.nav.bookNow], ['about', t.nav.about], ['contact', t.nav.contact]].map(([s, label]) => (
                <li key={s} className={currentSection === s ? 'active' : ''}>
                  <button onClick={() => navigate(s)}>{label}</button>
                </li>
              ))}
            </ul>
            <button className="lang-toggle" onClick={() => setLang(lang === 'es' ? 'en' : 'es')}>
              {lang === 'es' ? 'EN' : 'ES'}
            </button>
          </div>
        </div>
      </nav>

      <div className={`mobile-overlay ${menuOpen ? 'open' : ''}`} aria-hidden={!menuOpen}>
        <div className="mobile-overlay-header">
          <button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">✕</button>
        </div>
        <ul className="mobile-menu-items">
          {[['home', t.nav.home], ['rooms', t.nav.rooms], ['booking', t.nav.bookNow], ['about', t.nav.about], ['contact', t.nav.contact]].map(([s, label]) => (
            <li key={s} className={currentSection === s ? 'active' : ''}>
              <button onClick={() => navigate(s)}>{label}</button>
            </li>
          ))}
        </ul>
        <button className="mobile-cta" onClick={() => navigate('booking')}>
          {t.nav.bookNow} →
        </button>
        <a href="https://instagram.com/lasnubeshostal" className="mobile-instagram"
           target="_blank" rel="noreferrer">📷 @lasnubeshostal</a>
        <div className="mobile-lang">
          <button className="lang-toggle" onClick={() => setLang(lang === 'es' ? 'en' : 'es')}>
            {lang === 'es' ? 'EN' : 'ES'}
          </button>
        </div>
      </div>
      {menuOpen && <div className="mobile-backdrop" onClick={() => setMenuOpen(false)} />}
    </>
  );

  const HomePage = () => (
    <div className="homepage">
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-text">
            <span className="hero-badge">{t.hero.badge}</span>
            <h1>Las Nubes Hostal</h1>
            <p className="hero-subtitle">{t.hero.subtitle}</p>
            <p className="hero-description">{t.hero.description}</p>
            <div className="hero-features">
              {[['🌋', t.hero.features.mountain], ['🔥', t.hero.features.fireplace], ['🍳', t.hero.features.kitchen], ['🐾', t.hero.features.petFriendly]].map(([icon, label]) => (
                <div key={label} className="feature-item">
                  <span className="feature-icon">{icon}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <p className="hero-price">{t.hero.from} <strong>$20{t.hero.perNight}</strong></p>
            <button className="cta-button" onClick={() => navigate('booking')}>{t.hero.cta}</button>
          </div>
          <div className="hero-image">
            <img src="https://images.unsplash.com/photo-1602436324859-62a81466e723?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwxfHxtb3VudGFpbiUyMGhvc3RlbHxlbnwwfHx8fDE3NTIyMTY0MjZ8MA&ixlib=rb-4.1.0&q=85" alt="Las Nubes Hostal" />
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="container">
          <h2>{t.whyUs.title}</h2>
          <p className="section-description">{t.whyUs.subtitle}</p>
          <div className="features-grid-home">
            {t.whyUs.cards.map((card) => (
              <div key={card.title} className="feature-card">
                <div className="feature-icon-large">{card.icon}</div>
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="location-section">
        <div className="container">
          <div className="location-content">
            <div className="location-text">
              <h2>{t.location.title}</h2>
              <p>{t.location.description}</p>
              <div className="location-highlights">
                {t.location.highlights.map((h) => (
                  <div key={h.title} className="highlight-item">
                    <span className="highlight-icon">{h.icon}</span>
                    <div><h4>{h.title}</h4><p>{h.desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="location-image">
              <img src="https://images.unsplash.com/photo-1562323150-c3f486a6f185?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwzfHxtb3VudGFpbiUyMGhvc3RlbHxlbnwwfHx8fDE3NTIyMTY0MjZ8MA&ixlib=rb-4.1.0&q=85" alt="Cerro Punta" />
            </div>
          </div>
        </div>
      </section>

      <section className="rooms-preview-section">
        <div className="container">
          <h2>{t.roomsPreview.title}</h2>
          <p className="section-description">{t.roomsPreview.subtitle}</p>
          <div className="rooms-preview-grid">
            {[
              { key: 'big_room', img: 'https://images.unsplash.com/photo-1744471868062-17a54faa3cf5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDF8MHwxfHNlYXJjaHwyfHxjb3p5JTIwYWNjb21tb2RhdGlvbnxlbnwwfHx8fDE3NTIyMTY0MzR8MA&ixlib=rb-4.1.0&q=85', price: '$45' },
              { key: 'mid_room', img: 'https://images.pexels.com/photos/18904093/pexels-photo-18904093.jpeg', price: '$35', popular: true },
              { key: 'shared_room', img: 'https://images.pexels.com/photos/32895225/pexels-photo-32895225.jpeg', price: '$20' },
            ].map(({ key, img, price, popular }) => (
              <div key={key} className={`room-preview-card ${popular ? 'featured' : ''}`}>
                {popular && <div className="badge">{t.roomsPreview.badge}</div>}
                <div className="room-preview-image"><img src={img} alt={t.rooms.details[key]?.name} /></div>
                <div className="room-preview-info">
                  <span className="room-icon">{t.rooms.details[key]?.icon}</span>
                  <h3>{t.rooms.details[key]?.name}</h3>
                  <div className="room-preview-price">{price}{t.hero.perNight}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="rooms-preview-cta">
            <button className="cta-button" onClick={() => navigate('rooms')}>{t.roomsPreview.cta}</button>
          </div>
        </div>
      </section>

      <section className="testimonials-section">
        <div className="container">
          <h2>{t.testimonials.title}</h2>
          <div className="testimonials-grid">
            {t.testimonials.items.map((item) => (
              <div key={item.author} className="testimonial-card">
                <div className="testimonial-stars">★★★★★</div>
                <div className="testimonial-content"><p>{item.text}</p></div>
                <div className="testimonial-author"><h4>{item.author}</h4><p>{item.country}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta-section">
        <div className="container">
          <div className="final-cta-content">
            <h2>{t.finalCta.title}</h2>
            <p>{t.finalCta.subtitle}</p>
            <div className="cta-buttons">
              <button className="cta-button primary" onClick={() => navigate('booking')}>{t.finalCta.bookNow}</button>
              <button className="cta-button secondary" onClick={() => navigate('contact')}>{t.finalCta.contact}</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  const RoomsPage = () => (
    <section className="rooms-section">
      <div className="container">
        <h2>{t.rooms.title}</h2>
        <p className="section-description">{t.rooms.subtitle}</p>
        <div className="rooms-grid">
          {Object.entries(rooms).map(([key, room]) => {
            const details = t.rooms.details[key];
            const imgs = {
              big_room: 'https://images.unsplash.com/photo-1744471868062-17a54faa3cf5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDF8MHwxfHNlYXJjaHwyfHxjb3p5JTIwYWNjb21tb2RhdGlvbnxlbnwwfHx8fDE3NTIyMTY0MzR8MA&ixlib=rb-4.1.0&q=85',
              mid_room: 'https://images.pexels.com/photos/18904093/pexels-photo-18904093.jpeg',
              shared_room: 'https://images.pexels.com/photos/32895225/pexels-photo-32895225.jpeg',
            };
            return (
              <div key={key} className={`room-card ${key === 'mid_room' ? 'featured-room' : ''}`}>
                {key === 'mid_room' && <div className="room-featured-badge">{t.roomsPreview.badge}</div>}
                <div className="room-image"><img src={imgs[key]} alt={details?.name} /></div>
                <div className="room-info">
                  <div className="room-info-header">
                    <span className="room-icon-large">{details?.icon}</span>
                    <div>
                      <h3>{details?.name || room.name}</h3>
                      <div className="room-price">{formatPrice(room.price)} <span>{t.rooms.perNight}</span></div>
                    </div>
                  </div>
                  <p className="room-description">{details?.longDesc || room.description}</p>
                  <div className="room-capacity-badge">{t.rooms.capacity.replace('{n}', room.capacity)}</div>
                  <div className="room-highlights">
                    {details?.highlights.map((h) => (
                      <span key={h} className="highlight-pill">✓ {h}</span>
                    ))}
                  </div>
                  <div className="room-amenities">
                    <h4>{t.rooms.amenities}</h4>
                    <ul>{room.amenities.map((a, i) => <li key={i}>{a}</li>)}</ul>
                  </div>
                  <button className="book-room-btn" onClick={() => { setBookingData(p => ({ ...p, room_type: key })); navigate('booking'); }}>
                    {t.rooms.bookBtn}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );

  const BookingPage = () => (
    <section className="booking-section">
      <div className="container">
        <h2>{t.booking.title}</h2>
        <p className="section-description">{t.booking.subtitle}</p>
        {message && <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>{message}</div>}
        <form onSubmit={handleBookingSubmit} className="booking-form">
          <div className="form-row">
            <div className="form-group">
              <label>{t.booking.fields.name}</label>
              <input type="text" required value={bookingData.guest_name} placeholder={t.booking.placeholders.name}
                onChange={(e) => setBookingData(p => ({ ...p, guest_name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>{t.booking.fields.email}</label>
              <input type="email" required value={bookingData.guest_email} placeholder={t.booking.placeholders.email}
                onChange={(e) => setBookingData(p => ({ ...p, guest_email: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t.booking.fields.phone}</label>
              <input type="tel" required value={bookingData.guest_phone} placeholder={t.booking.placeholders.phone}
                onChange={(e) => setBookingData(p => ({ ...p, guest_phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>{t.booking.fields.roomType}</label>
              <select required value={bookingData.room_type} onChange={(e) => setBookingData(p => ({ ...p, room_type: e.target.value }))}>
                <option value="">{t.booking.placeholders.roomSelect}</option>
                {Object.entries(rooms).map(([key, room]) => (
                  <option key={key} value={key}>{t.rooms.details[key]?.name || room.name} — {formatPrice(room.price)}{t.rooms.perNight}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t.booking.fields.checkIn}</label>
              <input type="date" required value={bookingData.check_in} min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setBookingData(p => ({ ...p, check_in: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>{t.booking.fields.checkOut}</label>
              <input type="date" required value={bookingData.check_out} min={bookingData.check_in || new Date().toISOString().split('T')[0]}
                onChange={(e) => setBookingData(p => ({ ...p, check_out: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t.booking.fields.guests}</label>
              <select required value={bookingData.guests} onChange={(e) => setBookingData(p => ({ ...p, guests: parseInt(e.target.value) }))}>
                {t.booking.guestOptions.map((o, i) => <option key={i} value={i + 1}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>{t.booking.fields.requests}</label>
            <textarea value={bookingData.special_requests} placeholder={t.booking.placeholders.requests} rows="4"
              onChange={(e) => setBookingData(p => ({ ...p, special_requests: e.target.value }))} />
          </div>
          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? t.booking.processing : t.booking.submitBtn}
          </button>
        </form>
      </div>
    </section>
  );

  const AboutPage = () => (
    <section className="about-section">
      <div className="container">
        <h2>{t.about.title}</h2>
        <div className="about-content">
          <div className="about-text">
            <div className="family-banner">
              <span className="family-icon">🏡</span>
              <div>
                <h3>{t.about.family}</h3>
                <p>{t.about.familyDesc}</p>
              </div>
            </div>
            <p>{t.about.p1}</p>
            <p>{t.about.p2}</p>
            <div className="features-grid">
              {t.about.features.map((f) => (
                <div key={f.title} className="feature">
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="about-image">
            <img src="https://images.pexels.com/photos/32895225/pexels-photo-32895225.jpeg" alt="Las Nubes Hostal" />
          </div>
        </div>
      </div>
    </section>
  );

  const ContactPage = () => (
    <section className="contact-section">
      <div className="container">
        <h2>{t.contact.title}</h2>
        <p className="section-description">{t.contact.subtitle}</p>
        <div className="contact-content">
          <div className="contact-info">
            <h3>{t.contact.getInTouch}</h3>
            {[
              { label: t.contact.address, value: 'El Alto las Nubes, Cerro Punta\nChiriquí, Panamá' },
              { label: t.contact.phone, value: '+507 6810-9090', href: 'tel:+50768109090' },
              { label: t.contact.email, value: 'lasnubeshostalinfo@gmail.com', href: 'mailto:lasnubeshostalinfo@gmail.com' },
              { label: t.contact.instagram, value: '@lasnubeshostal', href: 'https://instagram.com/lasnubeshostal' },
            ].map(({ label, value, href }) => (
              <div key={label} className="contact-item">
                <strong>{label}</strong>
                {href ? <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{value}</a> : <p style={{ whiteSpace: 'pre-line' }}>{value}</p>}
              </div>
            ))}
          </div>
          <div className="contact-form-container">
            <h3>{t.contact.sendMessage}</h3>
            {message && <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>{message}</div>}
            <form onSubmit={handleContactSubmit} className="contact-form">
              {[
                { field: 'name', type: 'text', label: t.contact.fields.name, ph: t.contact.placeholders.name },
                { field: 'email', type: 'email', label: t.contact.fields.email, ph: t.contact.placeholders.email },
                { field: 'phone', type: 'tel', label: t.contact.fields.phone, ph: t.contact.placeholders.phone, required: false },
              ].map(({ field, type, label, ph, required = true }) => (
                <div key={field} className="form-group">
                  <label>{label}</label>
                  <input type={type} required={required} value={contactData[field]} placeholder={ph}
                    onChange={(e) => setContactData(p => ({ ...p, [field]: e.target.value }))} />
                </div>
              ))}
              <div className="form-group">
                <label>{t.contact.fields.message}</label>
                <textarea required value={contactData.message} placeholder={t.contact.placeholders.message} rows="5"
                  onChange={(e) => setContactData(p => ({ ...p, message: e.target.value }))} />
              </div>
              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? t.contact.sending : t.contact.submitBtn}
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
          <div className="success-icon">🎉</div>
          <h2>{t.success.title}</h2>
          <p className="success-thanks">{t.success.thanks}</p>
          <p>{t.success.p1}</p>
          <p>{t.success.p2}</p>
          <button className="cta-button" onClick={() => navigate('home')}>{t.success.backHome}</button>
        </div>
      </div>
    </section>
  );

  const Footer = () => (
    <footer className="footer">
      <div className="footer-top">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <h3>Las Nubes Hostal</h3>
              <p className="footer-tagline">{t.footer.tagline}</p>
              <p className="footer-desc">{t.footer.description}</p>
              <p className="footer-family">{t.footer.family}</p>
              <div className="footer-social">
                <a href="https://instagram.com/lasnubeshostal" target="_blank" rel="noreferrer" className="social-link">
                  📱 @lasnubeshostal
                </a>
              </div>
            </div>
            <div className="footer-col">
              <h4>{t.footer.quickLinks}</h4>
              <ul className="footer-links">
                {[['home', t.nav.home], ['rooms', t.nav.rooms], ['booking', t.nav.bookNow], ['about', t.nav.about], ['contact', t.nav.contact]].map(([s, label]) => (
                  <li key={s}><button onClick={() => navigate(s)}>{label}</button></li>
                ))}
              </ul>
            </div>
            <div className="footer-col">
              <h4>{t.footer.contactTitle}</h4>
              <div className="footer-contact-list">
                <div className="footer-contact-item">
                  <span>📍</span>
                  <span>El Alto las Nubes<br />Cerro Punta, Chiriquí<br />Panamá</span>
                </div>
                <div className="footer-contact-item">
                  <span>📞</span>
                  <a href="tel:+50768109090">+507 6810-9090</a>
                </div>
                <div className="footer-contact-item">
                  <span>✉️</span>
                  <a href="mailto:lasnubeshostalinfo@gmail.com">lasnubeshostalinfo@gmail.com</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container">
          <p>{t.footer.copyright}</p>
        </div>
      </div>
    </footer>
  );

  const sections = { home: <HomePage />, rooms: <RoomsPage />, booking: <BookingPage />, about: <AboutPage />, contact: <ContactPage />, 'booking-success': <BookingSuccessPage /> };

  return (
    <div className="App">
      <NavBar />
      {sections[currentSection] || <HomePage />}
      <Footer />
    </div>
  );
};

export default App;
