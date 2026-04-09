# 🎬 MOTION & ANIMATION (VERY IMPORTANT)

Use **Framer Motion** to create smooth, modern, meaningful animations.

### Principles

* Animations must **improve UX clarity**, not distract
* Keep them **fast, subtle, and responsive**
* Avoid over-animation

---

### Required Animations

#### Page & Layout

* Page transitions:

  * Fade + slight slide (opacity + translateY)
* Sidebar:

  * Smooth expand/collapse
* Route changes:

  * Soft transition between pages

---

#### Cards & Components

* Card hover:

  * Scale (1.02) + shadow lift
* Buttons:

  * Tap/press effect (scale down slightly)
* Tables:

  * Row hover highlight

---

#### Modals & Forms

* Modal:

  * Fade in + scale up (spring animation)
* Form validation:

  * Shake animation on error
* Toast notifications:

  * Slide in from top/right

---

#### Face Recognition (VERY IMPORTANT)

* Webcam scanning state:

  * Pulse / scanning overlay animation
* Detecting state:

  * Animated loading (spinner or shimmer)
* Success:

  * Smooth green highlight + check icon animation
* Error:

  * Subtle shake + red feedback

👉 Must clearly communicate system status in <10s

---

#### AI Chatbot

* Floating button:

  * Bounce or pulse idle animation
* Open chat:

  * Expand from bottom-right (scale + fade)
* Messages:

  * Staggered appearance (chat bubbles animate in)

---

#### Loading & Empty States

* Skeleton loading:

  * Shimmer effect
* Empty states:

  * Fade-in illustration + text

---

### Performance Notes

* Use lightweight animations
* Avoid blocking interactions
* Keep transitions under 300ms–500ms

---

👉 Overall goal: make the app feel like a **premium SaaS product (Stripe / Linear style)**
