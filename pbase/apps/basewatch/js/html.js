// Function to load a section using a full file name with a base URL
function loadSection(fileName, sectionId) {
  const baseUrl = '/html/'; // Define the base URL for partials
  const sectionElement = document.getElementById(sectionId);
  sectionElement.setAttribute('hx-get', baseUrl + fileName); // Concatenate base URL with file name
  sectionElement.setAttribute('hx-trigger', 'load');
  htmx.process(sectionElement);
}

// Function to handle the Info button
function showInfo() {
  alert("This is the PJAQA system. Contact support for more information.");
}

// Function to log out the user
function logout() {
  localStorage.removeItem('authToken');
  window.location.href = '/';
}