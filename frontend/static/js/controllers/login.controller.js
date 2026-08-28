import { saveAccessToken } from "../models/session.js";

const toggleBtn = document.getElementById("toggleBtn");
const passwordInput = document.getElementById("password");
const form = document.getElementById("loginForm");
const formStatus = document.getElementById("formStatus");
const submitBtn = document.getElementById("submitBtn");
const emailField = document.getElementById("emailField");
const passwordField = document.getElementById("passwordField");
const emailInput = document.getElementById("email");

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

toggleBtn.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";
  passwordInput.type = isHidden ? "text" : "password";
  toggleBtn.textContent = isHidden ? "ocultar" : "mostrar";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  let valid = true;
  formStatus.textContent = "";

  if (!isValidEmail(emailInput.value)) {
    emailField.dataset.error = "true";
    valid = false;
  } else {
    delete emailField.dataset.error;
  }

  if (passwordInput.value.length === 0) {
    passwordField.dataset.error = "true";
    valid = false;
  } else {
    delete passwordField.dataset.error;
  }

  if (!valid) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "Entrando...";

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailInput.value.trim(),
        password: passwordInput.value,
      }),
    });

    const body = await response.json();
    const detail = Array.isArray(body.detail) ? body.detail[0]?.msg : body.detail;
    if (!response.ok) throw new Error(detail || "Não foi possível entrar.");

    saveAccessToken(
      body.access_token,
      document.getElementById("remember").checked,
    );
    window.location.href = "/dashboard";
  } catch (error) {
    formStatus.textContent = error.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Entrar";
  }
});

emailInput.addEventListener("input", () => delete emailField.dataset.error);
passwordInput.addEventListener("input", () => delete passwordField.dataset.error);
