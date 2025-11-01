<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Get the project root directory (go up from web/api/ to project root)
$projectRoot = dirname(dirname(__DIR__));

// Execute the local_ast.sh script to get real module data
$astScript = $projectRoot . '/bash/modules/local_ast.sh';

if (!file_exists($astScript)) {
    http_response_code(500);
    echo json_encode(['error' => 'AST script not found: ' . $astScript]);
    exit;
}

// Execute the script and capture output
$command = "cd " . escapeshellarg($projectRoot) . " && bash " . escapeshellarg($astScript) . " ast 2>&1";
$output = shell_exec($command);

if ($output === null) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to execute AST script']);
    exit;
}

// Try to decode the JSON output
$data = json_decode($output, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Invalid JSON output from AST script',
        'json_error' => json_last_error_msg(),
        'raw_output' => $output
    ]);
    exit;
}

// Return the real module data
echo json_encode($data);
?>