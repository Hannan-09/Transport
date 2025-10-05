// Simple in-memory authentication for testing
// This is a fallback when database is not available

const users = [
  { id: "1", phone_number: "1234567890", pin_code: "123456" },
  { id: "2", phone_number: "9876543210", pin_code: "654321" },
];

export const simpleAuthAPI = {
  // Register new user
  register: async (phoneNumber, pinCode) => {
    // Check if phone number already exists
    const existingUser = users.find(
      (user) => user.phone_number === phoneNumber
    );

    if (existingUser) {
      throw new Error("Phone number already registered");
    }

    // Create new user
    const newUser = {
      id: Date.now().toString(),
      phone_number: phoneNumber,
      pin_code: pinCode,
      created_at: new Date().toISOString(),
    };

    users.push(newUser);
    return newUser;
  },

  // Login user
  login: async (phoneNumber, pinCode) => {
    const user = users.find(
      (u) => u.phone_number === phoneNumber && u.pin_code === pinCode
    );

    if (!user) {
      throw new Error("Invalid phone number or PIN");
    }

    return user;
  },

  // Check if phone number exists
  checkPhoneExists: async (phoneNumber) => {
    return users.some((user) => user.phone_number === phoneNumber);
  },
};
