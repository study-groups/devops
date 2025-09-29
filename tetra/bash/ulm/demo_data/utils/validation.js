export const validators = {
    email: (email) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    },

    password: (password) => {
        return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
    },

    required: (value) => {
        return value != null && value !== '';
    }
};

export function validateInput(data, schema) {
    const errors = {};

    for (const [field, rules] of Object.entries(schema)) {
        for (const rule of rules) {
            if (!validators[rule](data[field])) {
                errors[field] = errors[field] || [];
                errors[field].push(`${field} failed ${rule} validation`);
            }
        }
    }

    return Object.keys(errors).length === 0 ? null : errors;
}
