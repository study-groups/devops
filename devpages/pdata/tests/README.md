## Running Tests

This package comes with a suite of end-to-end API tests to verify its functionality. To run these tests after installing the package:

1.  **Navigate to the package directory:**
    Open your terminal and change to the directory where `@nodeholder/pdata` was installed within your project:
    ```bash
    cd node_modules/@nodeholder/pdata
    ```

2.  **Install development dependencies:**
    The tests require additional development dependencies (like Jest, Supertest, etc.). Install them by running:
    ```bash
    npm install
    ```
    *(This command will read the `devDependencies` from this package's `package.json` and install them locally within `node_modules/@nodeholder/pdata/node_modules`)*

3.  **Set up test data (if not already present or if you want to regenerate):**
    The tests rely on a predefined set of users and roles located in `tests/pdata_test_root/`. These files (`users.csv`, `roles.csv`) are included with the package. If you need to regenerate them for any reason (e.g., after modifying `tests/setupTestUsers.js`), you can run:
    ```bash
    npm run setup-test-users
    ```
    *(Typically, this step is not needed as the pre-generated files should work out-of-the-box.)*

4.  **Run the tests:**
    Execute the test suite using the following command:
    ```bash
    npm test
    ```
    This will run the Jest tests defined in `tests/api.test.js`, which will:
    *   Set the `PD_DIR` environment variable to `tests/pdata_test_root/` for the duration of the tests.
    *   Start a test Express server using the PData module.
    *   Make API requests to this server to verify endpoints for listing, reading, writing, deleting, and uploading files.
    *   Perform authentication checks.

**Prerequisites:**
*   Node.js (version compatible with the package, e.g., >=18.0.0 as per your `engines` field) must be installed.
