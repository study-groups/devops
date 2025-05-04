
// Function to handle form submission (triggered by pressing Enter)
function handleLoginFormSubmit(event) {
  event.preventDefault();
  login();
  return false;
}

// List of users with generic names and their corresponding password hashes
const users = [
  {
    username: "user1",
    passwordHash: "336662020ea81bdbcf40bd56032ce38b1eba6eda43c4d2cd92390d0c45005d6f"
  },
  // Add more users as needed
];

// Function to hash the password using SHA-256
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Function to check if the user is already signed in
function checkAuthOnLoad() {
  const token = localStorage.getItem('authToken');
  const signInButton = document.getElementById('signInButton');
  const goToButton = document.getElementById('goToButton');
  const hashDisplay = document.getElementById('hashDisplay');

  if (token && token.startsWith('Bearer ')) {
    // User is already signed in
    signInButton.textContent = 'Sign Out';
    goToButton.disabled = false;
    goToButton.classList.remove('bg-gray-500');
    goToButton.classList.add('bg-blue-500', 'hover:bg-blue-700');
    hashDisplay.textContent = token.substring(7, 39); // Display first 32 chars of the token
    hashDisplay.style.color = '#888888'; // Grey color
  }
}

async function login() {
  const password = document.getElementById('password').value;
  const statusModal = document.getElementById('statusModal');
  const statusText = document.getElementById('statusText');
  const hashDisplay = document.getElementById('hashDisplay');
  const signInButton = document.getElementById('signInButton');
  const goToButton = document.getElementById('goToButton');

  // Check if the current state is signing out
  if (signInButton.textContent === 'Sign Out') {
    localStorage.removeItem('authToken'); // Clear the token from localStorage
    signInButton.textContent = 'Sign In'; // Revert to Sign In
    goToButton.disabled = true; // Disable the Enter button
    goToButton.classList.remove('bg-blue-500', 'hover:bg-blue-700');
    goToButton.classList.add('bg-gray-500');
    hashDisplay.textContent = ''; // Clear the hash display
    return; // Exit the function to prevent further processing
  }

  // Hash the entered password
  const hash = await hashPassword(password);

  // Check if the hashed password matches any in the users list
  const user = users.find(user => user.passwordHash === hash);

  if (user) {
    localStorage.setItem('authToken', `Bearer ${hash}`); // Store the Bearer token
    signInButton.textContent = 'Sign Out'; // Change Sign In to Sign Out
    goToButton.disabled = false; // Enable Enter button
    goToButton.classList.remove('bg-gray-500');
    goToButton.classList.add('bg-blue-500', 'hover:bg-blue-700');
    hashDisplay.textContent = hash.substring(0, 32); // Display first 32 chars of the hash
    hashDisplay.style.color = '#888888'; // Grey color
    statusModal.classList.add('hidden'); // Hide the modal since we no longer show a success message
  } else {
    statusText.textContent = 'Invalid';
    document.getElementById('backButton').classList.remove('hidden'); // Show the Back button if login fails
    hashDisplay.textContent = ''; // Clear the hash display
    statusModal.classList.remove('hidden'); // Show the status modal
  }
}

function backToLogin() {
  const statusModal = document.getElementById('statusModal');
  const passwordInput = document.getElementById('password');

  statusModal.classList.add('hidden'); // Hide the status modal
  passwordInput.value = ''; // Clear the password input field
  passwordInput.focus(); // Set focus back to the password field
}

function goToIndex() {
  window.location.href = 'index.html'; // Redirect to the protected index page
}
