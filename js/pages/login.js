import { login } from "../api/auth.js";

const form = document.querySelector(".login-form");
const emailInput = document.querySelector('input[name="email"]');
const passwordInput = document.querySelector('input[name="password"]');
const button = document.querySelector(".login-btn");
const errorBox = document.querySelector(".login-error");

form.addEventListener("submit", function (event) {
  event.preventDefault();
  submitForm();
});

async function submitForm() {
  clearMessages();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  // Stop if a field is empty.
  let hasError = false;
  if (email === "") {
    showFieldError(emailInput, "Please enter your email.");
    hasError = true;
  }
  if (password === "") {
    showFieldError(passwordInput, "Please enter your password.");
    hasError = true;
  }
  if (hasError) {
    return;
  }

  setLoading(true);

  const result = await login(email, password);

  setLoading(false);

  if (result.error) {
    errorBox.textContent = result.error.message;
    return;
  }

  redirectByRole(result.data.role);
}

function setLoading(isLoading) {
  button.disabled = isLoading;
  button.textContent = isLoading ? "Signing in..." : "Log in";
}

function showFieldError(input, message) {
  const field = input.closest(".field");
  let note = field.querySelector(".field-error");
  if (!note) {
    note = document.createElement("span");
    note.className = "field-error";
    field.appendChild(note);
  }
  note.textContent = message;
}

function clearMessages() {
  errorBox.textContent = "";
  document.querySelectorAll(".field-error").forEach(function (note) {
    note.textContent = "";
  });
}

function redirectByRole(role) {
  if (role === "admin") {
    window.location.href = "dashboard.html";
  } else if (role === "chef") {
    window.location.href = "../kitchen.html";
  }
}
