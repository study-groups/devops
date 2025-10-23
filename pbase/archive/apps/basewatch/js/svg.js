
// Function to fetch SVG definitions
function fetchSvgDefinitions() {
  const svgUrl = './assets/svg-defs.svg'; // Adjust this path as necessary

  fetch(svgUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok ' + response.statusText);
      }
      return response.text();
    })
    .then(svgData => {
      console.log("SVG data fetched successfully.");
      // Create a container to hold the SVG content
      const svgContainer = document.createElement('div');
      svgContainer.style.display = 'none'; // Hide it from view
      svgContainer.innerHTML = svgData;

      // Append the container to the body or a specific container
      document.body.appendChild(svgContainer);

      // Now you can reference the SVG elements by ID
      const svgArcadeLogo = document.querySelector('#svg_arcade_logo');
      if (svgArcadeLogo) {
        console.log("SVG Arcade Logo found in fetched data.");
      } else {
        console.log("SVG Arcade Logo not found in fetched data.");
      }
    })
    .catch(error => {
      console.error('There was a problem with the fetch operation:', error);
    });
}
