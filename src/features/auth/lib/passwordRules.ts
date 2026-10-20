/** The password rules of the backend (StrongPassword): 8 characters at least, a letter and a digit. */
export const isStrongPassword = (password: string) => password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
