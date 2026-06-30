import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff } from "lucide-react";
import logo from "@/assets/logo.png";

/* ─────────────────────────────────────────
   Pupil
───────────────────────────────────────── */
const Pupil = ({ size = 12, maxDistance = 5, pupilColor = "black", forceLookX, forceLookY }) => {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  const calcPos = () => {
    if (!ref.current) return { x: 0, y: 0 };
    if (forceLookX !== undefined && forceLookY !== undefined) return { x: forceLookX, y: forceLookY };
    const r = ref.current.getBoundingClientRect();
    const dx = mouse.x - (r.left + r.width / 2);
    const dy = mouse.y - (r.top + r.height / 2);
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), maxDistance);
    const angle = Math.atan2(dy, dx);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
  };

  const p = calcPos();
  return (
    <div ref={ref} style={{
      width: size, height: size, borderRadius: "50%",
      backgroundColor: pupilColor,
      transform: `translate(${p.x}px, ${p.y}px)`,
      transition: "transform 0.1s ease-out",
    }} />
  );
};

/* ─────────────────────────────────────────
   EyeBall
───────────────────────────────────────── */
const EyeBall = ({ size = 20, pupilSize = 8, maxDistance = 6, eyeColor = "white", pupilColor = "#2D2D2D", isBlinking = false, forceLookX, forceLookY }) => {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  const calcPos = () => {
    if (!ref.current) return { x: 0, y: 0 };
    if (forceLookX !== undefined && forceLookY !== undefined) return { x: forceLookX, y: forceLookY };
    const r = ref.current.getBoundingClientRect();
    const dx = mouse.x - (r.left + r.width / 2);
    const dy = mouse.y - (r.top + r.height / 2);
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), maxDistance);
    const angle = Math.atan2(dy, dx);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
  };

  const p = calcPos();
  return (
    <div ref={ref} style={{
      width: size, height: isBlinking ? 2 : size,
      borderRadius: "50%", backgroundColor: eyeColor,
      overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
      transition: "height 0.15s",
    }}>
      {!isBlinking && (
        <div style={{
          width: pupilSize, height: pupilSize, borderRadius: "50%",
          backgroundColor: pupilColor,
          transform: `translate(${p.x}px, ${p.y}px)`,
          transition: "transform 0.1s ease-out",
        }} />
      )}
    </div>
  );
};

/* ─────────────────────────────────────────
   Characters scene — 520×400 canvas,
   centred by left: 50%; transform: translateX(-50%)
───────────────────────────────────────── */
const CharactersScene = ({ isTyping, password, showPassword, tallCharColor = "#6C3FF5" }) => {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [blink1, setBlink1] = useState(false);
  const [blink2, setBlink2] = useState(false);
  const [lookEachOther, setLookEachOther] = useState(false);
  const [peeking, setPeeking] = useState(false);

  const r1 = useRef(null);
  const r2 = useRef(null);
  const r3 = useRef(null);
  const r4 = useRef(null);

  useEffect(() => {
    const h = (e) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  // blink char1
  useEffect(() => {
    const schedule = () => {
      const t = setTimeout(() => {
        setBlink1(true);
        setTimeout(() => { setBlink1(false); schedule(); }, 150);
      }, Math.random() * 4000 + 3000);
      return t;
    };
    const t = schedule();
    return () => clearTimeout(t);
  }, []);

  // blink char2
  useEffect(() => {
    const schedule = () => {
      const t = setTimeout(() => {
        setBlink2(true);
        setTimeout(() => { setBlink2(false); schedule(); }, 150);
      }, Math.random() * 4000 + 2000);
      return t;
    };
    const t = schedule();
    return () => clearTimeout(t);
  }, []);

  // look at each other while typing
  useEffect(() => {
    if (isTyping) {
      setLookEachOther(true);
      const t = setTimeout(() => setLookEachOther(false), 800);
      return () => clearTimeout(t);
    } else {
      setLookEachOther(false);
    }
  }, [isTyping]);

  // peeking when password visible
  useEffect(() => {
    if (password.length > 0 && showPassword) {
      const t = setTimeout(() => {
        setPeeking(true);
        setTimeout(() => setPeeking(false), 800);
      }, Math.random() * 3000 + 2000);
      return () => clearTimeout(t);
    } else {
      setPeeking(false);
    }
  }, [password, showPassword, peeking]);

  const calcPos = (ref) => {
    if (!ref.current) return { faceX: 0, faceY: 0, bodySkew: 0 };
    const rect = ref.current.getBoundingClientRect();
    const dx = mouse.x - (rect.left + rect.width / 2);
    const dy = mouse.y - (rect.top + rect.height / 3);
    return {
      faceX: Math.max(-15, Math.min(15, dx / 20)),
      faceY: Math.max(-10, Math.min(10, dy / 30)),
      bodySkew: Math.max(-6, Math.min(6, -dx / 120)),
    };
  };

  const p1 = calcPos(r1);
  const p2 = calcPos(r2);
  const p3 = calcPos(r3);
  const p4 = calcPos(r4);

  const hiding = password.length > 0 && !showPassword;
  const showing = password.length > 0 && showPassword;

  // Canvas is 520px wide, 400px tall.
  // Characters (left→right): orange semicircle, tall rect, black rect, yellow capsule
  // orange: x=0, w=220, h=180
  // tall:   x=60, w=170, h=340
  // black:  x=210, w=110, h=280
  // yellow: x=290, w=130, h=210

  return (
    // Outer: full width, fixed height, flex to centre the canvas
    <div style={{ width: "100%", height: "420px", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      {/* Canvas: fixed 520×420, characters absolutely positioned inside */}
      <div style={{ position: "relative", width: "520px", height: "420px", flexShrink: 0 }}>

        {/* Tall back character */}
        <div
          ref={r1}
          style={{
            position: "absolute", bottom: 0,
            left: "115px", width: "170px",
            height: isTyping || hiding ? "390px" : "340px",
            backgroundColor: tallCharColor,
            borderRadius: "12px 12px 0 0",
            zIndex: 1,
            transform: showing
              ? "skewX(0deg)"
              : isTyping || hiding
              ? `skewX(${(p1.bodySkew || 0) - 12}deg) translateX(40px)`
              : `skewX(${p1.bodySkew || 0}deg)`,
            transformOrigin: "bottom center",
            transition: "all 0.7s ease-in-out",
          }}
        >
          <div style={{
            position: "absolute",
            left: showing ? "18px" : lookEachOther ? "56px" : `${44 + p1.faceX}px`,
            top:  showing ? "32px" : lookEachOther ? "60px" : `${38 + p1.faceY}px`,
            display: "flex", gap: "28px",
            transition: "all 0.7s ease-in-out",
          }}>
            <EyeBall size={20} pupilSize={8} isBlinking={blink1}
              forceLookX={showing ? (peeking ? 4 : -4) : lookEachOther ? 3 : undefined}
              forceLookY={showing ? (peeking ? 5 : -4) : lookEachOther ? 4 : undefined}
            />
            <EyeBall size={20} pupilSize={8} isBlinking={blink1}
              forceLookX={showing ? (peeking ? 4 : -4) : lookEachOther ? 3 : undefined}
              forceLookY={showing ? (peeking ? 5 : -4) : lookEachOther ? 4 : undefined}
            />
          </div>
        </div>

        {/* Black middle character */}
        <div
          ref={r2}
          style={{
            position: "absolute", bottom: 0,
            left: "273px", width: "110px", height: "280px",
            backgroundColor: "#2D2D2D",
            borderRadius: "10px 10px 0 0",
            zIndex: 2,
            transform: showing
              ? "skewX(0deg)"
              : lookEachOther
              ? `skewX(${(p2.bodySkew || 0) * 1.5 + 10}deg) translateX(20px)`
              : isTyping || hiding
              ? `skewX(${(p2.bodySkew || 0) * 1.5}deg)`
              : `skewX(${p2.bodySkew || 0}deg)`,
            transformOrigin: "bottom center",
            transition: "all 0.7s ease-in-out",
          }}
        >
          <div style={{
            position: "absolute",
            left: showing ? "10px" : lookEachOther ? "28px" : `${22 + p2.faceX}px`,
            top:  showing ? "24px" : lookEachOther ? "10px" : `${28 + p2.faceY}px`,
            display: "flex", gap: "22px",
            transition: "all 0.7s ease-in-out",
          }}>
            <EyeBall size={18} pupilSize={7} isBlinking={blink2}
              forceLookX={showing ? -4 : lookEachOther ? 0 : undefined}
              forceLookY={showing ? -4 : lookEachOther ? -4 : undefined}
            />
            <EyeBall size={18} pupilSize={7} isBlinking={blink2}
              forceLookX={showing ? -4 : lookEachOther ? 0 : undefined}
              forceLookY={showing ? -4 : lookEachOther ? -4 : undefined}
            />
          </div>
        </div>

        {/* Orange semicircle – front left */}
        <div
          ref={r3}
          style={{
            position: "absolute", bottom: 0,
            left: "55px", width: "230px", height: "190px",
            backgroundColor: "#FF9B6B",
            borderRadius: "115px 115px 0 0",
            zIndex: 3,
            transform: showing ? "skewX(0deg)" : `skewX(${p3.bodySkew || 0}deg)`,
            transformOrigin: "bottom center",
            transition: "all 0.7s ease-in-out",
          }}
        >
          <div style={{
            position: "absolute",
            left: showing ? "46px" : `${75 + (p3.faceX || 0)}px`,
            top:  showing ? "80px" : `${84 + (p3.faceY || 0)}px`,
            display: "flex", gap: "28px",
            transition: "all 0.2s ease-out",
          }}>
            <Pupil size={14} maxDistance={5} pupilColor="#2D2D2D"
              forceLookX={showing ? -5 : undefined}
              forceLookY={showing ? -4 : undefined}
            />
            <Pupil size={14} maxDistance={5} pupilColor="#2D2D2D"
              forceLookX={showing ? -5 : undefined}
              forceLookY={showing ? -4 : undefined}
            />
          </div>
        </div>

        {/* Yellow capsule – front right */}
        <div
          ref={r4}
          style={{
            position: "absolute", bottom: 0,
            left: "362px", width: "130px", height: "215px",
            backgroundColor: "#E8D754",
            borderRadius: "65px 65px 0 0",
            zIndex: 4,
            transform: showing ? "skewX(0deg)" : `skewX(${p4.bodySkew || 0}deg)`,
            transformOrigin: "bottom center",
            transition: "all 0.7s ease-in-out",
          }}
        >
          <div style={{
            position: "absolute",
            left: showing ? "16px" : `${46 + (p4.faceX || 0)}px`,
            top:  showing ? "30px" : `${36 + (p4.faceY || 0)}px`,
            display: "flex", gap: "20px",
            transition: "all 0.2s ease-out",
          }}>
            <Pupil size={14} maxDistance={5} pupilColor="#2D2D2D"
              forceLookX={showing ? -5 : undefined}
              forceLookY={showing ? -4 : undefined}
            />
            <Pupil size={14} maxDistance={5} pupilColor="#2D2D2D"
              forceLookX={showing ? -5 : undefined}
              forceLookY={showing ? -4 : undefined}
            />
          </div>
          {/* Mouth */}
          <div style={{
            position: "absolute",
            left: showing ? "10px" : `${34 + (p4.faceX || 0)}px`,
            top:  showing ? "82px" : `${82 + (p4.faceY || 0)}px`,
            width: "70px", height: "4px",
            backgroundColor: "#2D2D2D", borderRadius: "2px",
            transition: "all 0.2s ease-out",
          }} />
        </div>

      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   Main AnimatedLoginPage component
───────────────────────────────────────── */
export function AnimatedLoginPage({
  subtitle = "Please enter your details",
  formTitle = "Welcome back!",
  buttonLabel = "Log in",
  footerLink,
  onSubmit,
  accentHex = "#10a37f",
  tallCharColor = "#6C3FF5",
  portalLabel = "",
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await onSubmit(username, password);
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1fr 1fr" }}>

      {/* ══ LEFT PANEL ══ */}
      <div
        style={{
          background: `linear-gradient(145deg, ${accentHex}f0 0%, ${accentHex} 55%, ${accentHex}cc 100%)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          gap: "24px",
          position: "relative",
          overflow: "hidden",
          color: "white",
        }}
      >
        {/* Decorative blobs */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(circle at 75% 15%, rgba(255,255,255,0.10) 0%, transparent 55%)",
        }} />
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(circle at 20% 85%, rgba(255,255,255,0.06) 0%, transparent 45%)",
        }} />

        {/* ── Branding: logo + name + portal label ── */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: "10px", position: "relative", zIndex: 2,
        }}>
          {/* White pill logo */}
          <div style={{
            background: "rgba(255,255,255,0.96)",
            borderRadius: "16px",
            padding: "8px 24px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <img src={logo} alt="AllDigi Tech" style={{ height: "44px", width: "auto", objectFit: "contain" }} />
          </div>

          {/* Bold brand name */}
          <div style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontWeight: 900,
            fontSize: "2.2rem",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            textShadow: "0 2px 14px rgba(0,0,0,0.22)",
            textAlign: "center",
          }}>
            AllDigi
          </div>

          {/* Portal badge */}
          {portalLabel && (
            <div style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.72)",
              textAlign: "center",
            }}>
              {portalLabel}
            </div>
          )}
        </div>

        {/* ── Characters scene ── */}
        <div style={{ position: "relative", zIndex: 2, width: "100%" }}>
          <CharactersScene
            isTyping={isTyping}
            password={password}
            showPassword={showPassword}
            tallCharColor={tallCharColor}
          />
        </div>
      </div>

      {/* ══ RIGHT PANEL ══ */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "32px", backgroundColor: "hsl(var(--background, 0 0% 100%))",
      }}>
        <div style={{ width: "100%", maxWidth: "420px" }}>

          {/* Heading */}
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h1 style={{ fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.025em", marginBottom: "8px" }}>
              {formTitle}
            </h1>
            <p style={{ fontSize: "0.875rem", color: "hsl(var(--muted-foreground, 215 16% 47%))" }}>
              {subtitle}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                autoComplete="off"
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                required
                className="h-12"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Label htmlFor="password">Password</Label>
              <div style={{ position: "relative" }}>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute", right: "12px", top: "50%",
                    transform: "translateY(-50%)", background: "none",
                    border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground, 215 16% 47%))",
                    display: "flex", alignItems: "center",
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Checkbox id="remember" />
                <Label htmlFor="remember" style={{ fontWeight: 400, cursor: "pointer" }}>
                  Remember for 30 days
                </Label>
              </div>
              <a href="#" style={{ fontSize: "0.875rem", fontWeight: 500, color: accentHex }}>
                Forgot password?
              </a>
            </div>

            {error && (
              <div style={{
                padding: "12px", fontSize: "0.875rem", color: "#f87171",
                background: "rgba(127,29,29,0.1)", border: "1px solid rgba(127,29,29,0.3)",
                borderRadius: "8px",
              }}>
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-medium text-white"
              size="lg"
              disabled={isLoading}
              style={{ backgroundColor: accentHex, borderColor: accentHex }}
            >
              {isLoading ? "Signing in…" : buttonLabel}
            </Button>
          </form>

          {/* Switch portal link */}
          {footerLink && (
            <div style={{ textAlign: "center", marginTop: "32px", fontSize: "0.875rem" }}>
              <button
                type="button"
                onClick={footerLink.onClick}
                style={{ color: accentHex, background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}
              >
                {footerLink.label}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AnimatedLoginPage;
