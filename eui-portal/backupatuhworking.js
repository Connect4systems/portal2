import { supabase } from "./supabase-config.js";

const loginForm = document.getElementById("login-form");
const identifierInput = document.getElementById("identifier");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("login-button");
const passwordToggle = document.getElementById("password-toggle");
const messageElement = document.getElementById("message");
const currentYearElement = document.getElementById("current-year");

const SUCCESS_REDIRECT = "./welcome.html";

/*
 * This domain is only used internally to turn usernames or phone-like
 * identifiers into an email-shaped Supabase Auth identity.
 */
const INTERNAL_LOGIN_DOMAIN = "connect4systems.com";

if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear();
}

function showMessage(text, type = "error") {
    if (!messageElement) {
        console.error(text);
        return;
    }

    messageElement.textContent = text;
    messageElement.className = `auth-message ${type}`;
}

function clearMessage() {
    if (!messageElement) {
        return;
    }

    messageElement.textContent = "";
    messageElement.className = "auth-message";
}

function setLoading(isLoading, text = "Continue securely") {
    loginButton.disabled = isLoading;

    loginButton.textContent = isLoading
        ? text
        : "Continue securely";
}

function normalizeIdentifier(value) {
    return value.trim().toLowerCase();
}

function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPhoneLike(value) {
    return /^[+()\d\s-]{6,25}$/.test(value);
}

function sanitizeInternalIdentifier(value) {
    const cleaned = value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9._-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^[.-]+|[.-]+$/g, "");

    return cleaned || "user";
}

function convertIdentifierToEmail(identifier) {
    if (isEmail(identifier)) {
        return identifier;
    }

    const safeIdentifier = sanitizeInternalIdentifier(identifier);

    return `${safeIdentifier}@${INTERNAL_LOGIN_DOMAIN}`;
}

function getIdentifierType(identifier) {
    if (isEmail(identifier)) {
        return "email";
    }

    if (isPhoneLike(identifier)) {
        return "phone";
    }

    return "username";
}

function isInvalidCredentialsError(error) {
    const message = error?.message?.toLowerCase() || "";

    return (
        message.includes("invalid login credentials") ||
        message.includes("invalid credentials")
    );
}

function isExistingUserError(error) {
    const message = error?.message?.toLowerCase() || "";

    return (
        message.includes("user already registered") ||
        message.includes("already been registered") ||
        message.includes("already exists")
    );
}

function getFriendlyErrorMessage(error) {
    const message = error?.message?.toLowerCase() || "";

    if (isExistingUserError(error)) {
        return "That account already exists, but the password is incorrect.";
    }

    if (isInvalidCredentialsError(error)) {
        return "The identifier or password is incorrect.";
    }

    if (message.includes("password")) {
        return error.message;
    }

    if (message.includes("email logins are disabled")) {
        return "Email authentication is still disabled in Supabase.";
    }

    if (
        message.includes("failed to fetch") ||
        message.includes("network")
    ) {
        return "Unable to connect to Supabase. Check your connection.";
    }

    if (message.includes("rate limit")) {
        return "Too many attempts. Wait briefly and try again.";
    }

    return error?.message || "Unable to continue.";
}

async function signIn(email, password) {
    return await supabase.auth.signInWithPassword({
        email,
        password
    });
}

async function createUser(
    email,
    password,
    originalIdentifier,
    identifierType
) {
    return await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                login_identifier: originalIdentifier,
                identifier_type: identifierType
            }
        }
    });
}

async function redirectExistingSession() {
    try {
        const {
            data: { session },
            error
        } = await supabase.auth.getSession();

        if (error) {
            console.error("Session check failed:", error.message);
            return;
        }

        if (session) {
            window.location.replace(SUCCESS_REDIRECT);
        }
    } catch (error) {
        console.error("Session check failed:", error);
    }
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    const originalIdentifier = normalizeIdentifier(
        identifierInput.value
    );

    const password = passwordInput.value;

    if (!originalIdentifier) {
        showMessage(
            "Enter an email address, phone number, or username."
        );

        identifierInput.focus();
        return;
    }

    if (originalIdentifier.length < 3) {
        showMessage(
            "The identifier must contain at least 3 characters."
        );

        identifierInput.focus();
        return;
    }

    if (!password) {
        showMessage("Enter your password.");
        passwordInput.focus();
        return;
    }

    if (password.length < 6) {
        showMessage(
            "The password must contain at least 6 characters."
        );

        passwordInput.focus();
        return;
    }

    const authEmail = convertIdentifierToEmail(
        originalIdentifier
    );

    const identifierType = getIdentifierType(
        originalIdentifier
    );

    setLoading(true, "Checking account...");

    try {
        /*
         * First try signing in.
         */
        const {
            data: loginData,
            error: loginError
        } = await signIn(authEmail, password);

        if (!loginError && loginData.session) {
            showMessage(
                "Login successful. Redirecting...",
                "success"
            );

            window.location.replace(SUCCESS_REDIRECT);
            return;
        }

        /*
         * Only try creating an account when login credentials
         * are reported as invalid.
         */
        if (
            loginError &&
            !isInvalidCredentialsError(loginError)
        ) {
            throw loginError;
        }

        setLoading(true, "Creating account...");

        const {
            data: signupData,
            error: signupError
        } = await createUser(
            authEmail,
            password,
            originalIdentifier,
            identifierType
        );

        if (signupError) {
            if (isExistingUserError(signupError)) {
                showMessage(
                    "That account already exists, but the password is incorrect."
                );

                return;
            }

            throw signupError;
        }

        if (signupData.session) {
            showMessage(
                "Account created successfully. Redirecting...",
                "success"
            );

            window.location.replace(SUCCESS_REDIRECT);
            return;
        }

        showMessage(
            "The account was created, but Supabase did not start a session. Confirm that email confirmation is disabled.",
            "success"
        );
    } catch (error) {
        console.error("Authentication error:", error);

        showMessage(
            getFriendlyErrorMessage(error),
            "error"
        );
    } finally {
        setLoading(false);
    }
});

if (passwordToggle) {
    passwordToggle.addEventListener("click", () => {
        const hidden = passwordInput.type === "password";

        passwordInput.type = hidden
            ? "text"
            : "password";

        passwordToggle.textContent = hidden
            ? "Hide"
            : "Show";

        passwordToggle.setAttribute(
            "aria-label",
            hidden
                ? "Hide password"
                : "Show password"
        );
    });
}

redirectExistingSession();