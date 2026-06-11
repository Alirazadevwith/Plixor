import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Landing = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: "#1A202C", background: "#FFFFFF" }}>

      <nav style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: scrolled ? "rgba(255,255,255,0.97)" : "#FFFFFF",
        borderBottom: scrolled ? "1px solid #E2E8F0" : "1px solid transparent",
        backdropFilter: scrolled ? "blur(8px)" : "none",
        transition: "all 0.3s ease",
      }}>
        <div style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          height: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <span style={{ fontSize: 24, fontWeight: 700, color: "#4A90E2", letterSpacing: "-0.5px" }}>PLIXOR</span>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4A90E2", marginTop: 2 }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 32 }} className="landing-nav-links">
            {[
              { label: "Features", id: "features" },
              { label: "How it Works", id: "how-it-works" },
              { label: "For Teachers", id: "for-who" },
              { label: "For Students", id: "for-who" },
            ].map((item) => (
              <span
                key={item.label}
                onClick={() => scrollToSection(item.id)}
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#4A5568",
                  cursor: "pointer",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => e.target.style.color = "#4A90E2"}
                onMouseLeave={(e) => e.target.style.color = "#4A5568"}
              >
                {item.label}
              </span>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }} className="landing-nav-buttons">
            <button
              onClick={() => navigate("/login")}
              style={{
                padding: "8px 20px",
                borderRadius: 6,
                border: "1px solid #4A90E2",
                background: "transparent",
                color: "#4A90E2",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => { e.target.style.background = "#EBF4FF"; }}
              onMouseLeave={(e) => { e.target.style.background = "transparent"; }}
            >
              Sign In
            </button>
            <button
              onClick={() => navigate("/login")}
              style={{
                padding: "8px 20px",
                borderRadius: 6,
                border: "none",
                background: "#4A90E2",
                color: "#FFFFFF",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => { e.target.style.background = "#2C5F8A"; }}
              onMouseLeave={(e) => { e.target.style.background = "#4A90E2"; }}
            >
              Get Started
            </button>
          </div>

          <button
            className="landing-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              display: "none",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 8,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1A202C" strokeWidth="2" strokeLinecap="round">
              {mobileMenuOpen ? (
                <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
              ) : (
                <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
              )}
            </svg>
          </button>
        </div>

        {mobileMenuOpen && (
          <div style={{
            background: "#FFFFFF",
            borderTop: "1px solid #E2E8F0",
            padding: "16px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}>
            {["Features", "How it Works", "For Teachers", "For Students"].map((label) => (
              <span
                key={label}
                onClick={() => scrollToSection(label === "For Teachers" || label === "For Students" ? "for-who" : label.toLowerCase().replace(/ /g, "-"))}
                style={{ fontSize: 15, fontWeight: 500, color: "#4A5568", cursor: "pointer" }}
              >
                {label}
              </span>
            ))}
            <div style={{ display: "flex", gap: 12, paddingTop: 8 }}>
              <button
                onClick={() => navigate("/login")}
                style={{ padding: "10px 20px", borderRadius: 6, border: "1px solid #4A90E2", background: "transparent", color: "#4A90E2", fontSize: 14, fontWeight: 600, cursor: "pointer", flex: 1 }}
              >
                Sign In
              </button>
              <button
                onClick={() => navigate("/login")}
                style={{ padding: "10px 20px", borderRadius: 6, border: "none", background: "#4A90E2", color: "#FFFFFF", fontSize: 14, fontWeight: 600, cursor: "pointer", flex: 1 }}
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </nav>

      <section style={{
        paddingTop: 140,
        paddingBottom: 80,
        background: "#F7F8FC",
        backgroundImage: "radial-gradient(circle, #E2E8F0 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        position: "relative",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", gap: 60, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 480px", minWidth: 300 }}>
            <div style={{
              display: "inline-block",
              padding: "6px 16px",
              background: "#EBF4FF",
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              color: "#4A90E2",
              marginBottom: 24,
            }}>
              🎓 Trusted by Universities
            </div>
            <h1 style={{
              fontSize: "clamp(32px, 5vw, 52px)",
              fontWeight: 700,
              lineHeight: 1.15,
              color: "#1A202C",
              marginBottom: 20,
            }}>
              AI-Powered Grading for{" "}
              <span style={{ color: "#4A90E2" }}>Modern Classrooms</span>
            </h1>
            <p style={{
              fontSize: 18,
              lineHeight: 1.7,
              color: "#4A5568",
              marginBottom: 32,
              maxWidth: 520,
            }}>
              Automate exam creation, evaluation, and analytics. Built for universities that demand accuracy.
            </p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <button
                onClick={() => navigate("/login")}
                style={{
                  padding: "14px 32px",
                  borderRadius: 8,
                  border: "none",
                  background: "#4A90E2",
                  color: "#FFFFFF",
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: "0 4px 14px rgba(74, 144, 226, 0.35)",
                }}
                onMouseEnter={(e) => { e.target.style.background = "#2C5F8A"; e.target.style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { e.target.style.background = "#4A90E2"; e.target.style.transform = "translateY(0)"; }}
              >
                Start for Free
              </button>
              <button
                onClick={() => scrollToSection("how-it-works")}
                style={{
                  padding: "14px 32px",
                  borderRadius: 8,
                  border: "1px solid #4A90E2",
                  background: "transparent",
                  color: "#4A90E2",
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => { e.target.style.background = "#EBF4FF"; }}
                onMouseLeave={(e) => { e.target.style.background = "transparent"; }}
              >
                See How It Works
              </button>
            </div>
          </div>

          <div style={{ flex: "1 1 400px", minWidth: 300 }}>
            <div style={{
              background: "#FFFFFF",
              borderRadius: 16,
              border: "1px solid #E2E8F0",
              boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
              padding: 24,
              position: "relative",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#1A202C" }}>Data Structures — Final Exam</div>
                  <div style={{ fontSize: 13, color: "#718096", marginTop: 4 }}>BSCS-5A • 60 minutes • 50 marks</div>
                </div>
                <span style={{ padding: "4px 12px", borderRadius: 12, background: "#F0FFF4", color: "#38A169", fontSize: 12, fontWeight: 600 }}>Active</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { q: "Q1. Explain B-Tree insertion with example", type: "Subjective", marks: "10" },
                  { q: "Q2. What is the time complexity of merge sort?", type: "MCQ", marks: "5" },
                  { q: "Q3. Describe AVL tree rotations", type: "Subjective", marks: "15" },
                ].map((item, i) => (
                  <div key={i} style={{
                    padding: "12px 16px",
                    background: "#F7F8FC",
                    borderRadius: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#1A202C" }}>{item.q}</div>
                      <div style={{ fontSize: 11, color: "#718096", marginTop: 2 }}>{item.type} • {item.marks} marks</div>
                    </div>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: i === 0 ? "#38A169" : "#E2E8F0" }} />
                  </div>
                ))}
              </div>
              <div style={{
                marginTop: 16,
                padding: "10px 16px",
                background: "#EBF4FF",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4A90E2" strokeWidth="2">
                  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" /><path d="M12 6v6l4 2" />
                </svg>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#4A90E2" }}>AI Evaluation in progress...</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{
        padding: "40px 24px",
        background: "#FFFFFF",
        borderTop: "1px solid #E2E8F0",
        borderBottom: "1px solid #E2E8F0",
      }}>
        <div style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          justifyContent: "center",
          gap: 60,
          flexWrap: "wrap",
        }}>
          {[
            { value: "10x", label: "Faster Grading", icon: "⚡" },
            { value: "98%", label: "Evaluation Accuracy", icon: "🎯" },
            { value: "500+", label: "Exams Evaluated", icon: "📝" },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: "center", minWidth: 180 }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>{stat.icon}</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#1A202C" }}>{stat.value}</div>
              <div style={{ fontSize: 14, color: "#718096", marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="features" style={{ padding: "80px 24px", background: "#FFFFFF" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: 32, fontWeight: 700, color: "#1A202C", marginBottom: 12 }}>
              Everything your institution needs
            </h2>
            <p style={{ fontSize: 16, color: "#4A5568", maxWidth: 560, margin: "0 auto" }}>
              A complete examination platform powered by AI for creating, proctoring, evaluating, and analyzing exams.
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 24,
          }}>
            {[
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a7 7 0 0 1 7 7c0 3-2 5.5-4 7.5L12 22l-3-5.5C7 14.5 5 12 5 9a7 7 0 0 1 7-7z" />
                    <circle cx="12" cy="9" r="2" />
                  </svg>
                ),
                title: "AI Answer Evaluation",
                desc: "Subjective answers evaluated by LangGraph AI with rubric-based criterion scoring",
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                ),
                title: "Smart MCQ Grading",
                desc: "Instant MCQ evaluation with detailed explanations for wrong answers",
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                ),
                title: "Exam Proctoring",
                desc: "Fullscreen lock, tab monitoring, and auto-submit on violations",
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 4V2" /><path d="M15 16v-2" /><path d="M8 9h2" /><path d="M20 9h2" /><path d="M17.8 11.8L19 13" /><path d="M15 9h0" /><path d="M17.8 6.2L19 5" /><path d="M3 21l9-9" /><path d="M12.2 6.2L11 5" />
                  </svg>
                ),
                title: "Question Generator",
                desc: "AI generates questions with model answers and rubrics from any topic",
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                ),
                title: "Analytics Dashboard",
                desc: "Section-wise performance, pass rates, and criterion analysis",
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                ),
                title: "CSV Export",
                desc: "Export complete results with scores, percentages and warnings",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                style={{
                  padding: 28,
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 8,
                  transition: "all 0.25s ease",
                  cursor: "default",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 8px 30px rgba(0,0,0,0.08)";
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.borderColor = "#4A90E2";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "#E2E8F0";
                }}
              >
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  background: "#EBF4FF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}>
                  {feature.icon}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 600, color: "#1A202C", marginBottom: 8 }}>
                  {feature.title}
                </h3>
                <p style={{ fontSize: 14, color: "#4A5568", lineHeight: 1.6 }}>
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" style={{ padding: "80px 24px", background: "#F7F8FC" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: 32, fontWeight: 700, color: "#1A202C", marginBottom: 12 }}>
              Simple 4-step workflow
            </h2>
            <p style={{ fontSize: 16, color: "#4A5568" }}>
              From exam creation to result analysis — fully automated.
            </p>
          </div>

          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 20,
            flexWrap: "wrap",
            position: "relative",
          }}>
            <div style={{
              position: "absolute",
              top: 32,
              left: "12%",
              right: "12%",
              height: 2,
              background: "repeating-linear-gradient(90deg, #4A90E2 0, #4A90E2 8px, transparent 8px, transparent 16px)",
              zIndex: 0,
            }} className="landing-step-line" />

            {[
              { step: "1", title: "Create Exam", desc: "Set up questions, rubrics, and assign to sections with AI assistance" },
              { step: "2", title: "Students Attempt", desc: "Proctored exam with fullscreen lock, timer, and auto-save" },
              { step: "3", title: "AI Evaluates", desc: "LangGraph evaluates answers using rubric criteria and RAG retrieval" },
              { step: "4", title: "Review Results", desc: "View analytics, override scores, and export reports" },
            ].map((item) => (
              <div key={item.step} style={{
                flex: "1 1 220px",
                textAlign: "center",
                position: "relative",
                zIndex: 1,
                minWidth: 200,
              }}>
                <div style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "#4A90E2",
                  color: "#FFFFFF",
                  fontSize: 24,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                  boxShadow: "0 4px 14px rgba(74, 144, 226, 0.3)",
                }}>
                  {item.step}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 600, color: "#1A202C", marginBottom: 8 }}>{item.title}</h3>
                <p style={{ fontSize: 14, color: "#4A5568", lineHeight: 1.6, maxWidth: 220, margin: "0 auto" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="for-who" style={{ padding: "80px 24px", background: "#EBF4FF" }}>
        <div style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
          gap: 40,
        }}>
          <div style={{
            background: "#FFFFFF",
            borderRadius: 12,
            padding: 40,
            border: "1px solid #E2E8F0",
          }}>
            <h3 style={{ fontSize: 24, fontWeight: 700, color: "#1A202C", marginBottom: 24 }}>
              Built for Educators
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                "Create exams with AI-generated questions and rubrics",
                "Automated grading saves 10x manual evaluation time",
                "Per-criterion scoring with detailed feedback",
                "Override AI scores with custom reasoning",
                "Export results to CSV with full analytics",
              ].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{
                    minWidth: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "#F0FFF4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 1,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38A169" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <span style={{ fontSize: 15, color: "#4A5568", lineHeight: 1.5 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            background: "#FFFFFF",
            borderRadius: 12,
            padding: 40,
            border: "1px solid #E2E8F0",
          }}>
            <h3 style={{ fontSize: 24, fontWeight: 700, color: "#1A202C", marginBottom: 24 }}>
              Seamless for Students
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                "Clean, distraction-free exam interface",
                "Auto-save answers every 30 seconds",
                "Real-time countdown timer with warnings",
                "Instant results with detailed AI feedback",
                "Per-question criterion scores and explanations",
              ].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{
                    minWidth: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "#EBF4FF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 1,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4A90E2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <span style={{ fontSize: 15, color: "#4A5568", lineHeight: 1.5 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section style={{
        padding: "80px 24px",
        background: "#1E2A3A",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h2 style={{ fontSize: 32, fontWeight: 700, color: "#FFFFFF", marginBottom: 16 }}>
            Ready to transform your classroom?
          </h2>
          <p style={{ fontSize: 17, color: "#A8B8C8", marginBottom: 32, lineHeight: 1.6 }}>
            Start using PLIXOR today — free for educators
          </p>
          <button
            onClick={() => navigate("/login")}
            style={{
              padding: "16px 40px",
              borderRadius: 8,
              border: "none",
              background: "#4A90E2",
              color: "#FFFFFF",
              fontSize: 17,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: "0 4px 14px rgba(74, 144, 226, 0.35)",
            }}
            onMouseEnter={(e) => { e.target.style.background = "#5DA0F0"; e.target.style.transform = "translateY(-2px)"; }}
            onMouseLeave={(e) => { e.target.style.background = "#4A90E2"; e.target.style.transform = "translateY(0)"; }}
          >
            Get Started Free
          </button>
        </div>
      </section>

      <footer style={{
        padding: "40px 24px",
        background: "#16202D",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 24,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#FFFFFF" }}>PLIXOR</span>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4A90E2" }} />
            </div>
            <p style={{ fontSize: 13, color: "#718096" }}>AI-Powered Examination & Evaluation</p>
          </div>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            {["Features", "Docs", "Privacy", "Terms"].map((link) => (
              <span
                key={link}
                style={{ fontSize: 13, color: "#A8B8C8", cursor: "pointer", transition: "color 0.2s" }}
                onMouseEnter={(e) => e.target.style.color = "#FFFFFF"}
                onMouseLeave={(e) => e.target.style.color = "#A8B8C8"}
              >
                {link}
              </span>
            ))}
          </div>
          <p style={{ fontSize: 13, color: "#718096" }}>© 2025 PLIXOR. All rights reserved.</p>
        </div>
      </footer>

      <style>{`
        @media (max-width: 768px) {
          .landing-nav-links { display: none !important; }
          .landing-nav-buttons { display: none !important; }
          .landing-mobile-toggle { display: block !important; }
          .landing-step-line { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default Landing;
