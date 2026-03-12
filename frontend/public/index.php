<?php
// basic entry point for the application. establish autoloading and routing
require_once __DIR__ . '/../app/helpers/view.php';

// basic routing 
$page = $_GET['page'] ?? 'home';

switch ($page) {
    case 'home':
        view('pages/home');
        break;

    case 'dash':
        view('pages/dash');
	break;

    case 'profile':
	    view('pages/profile');
	    break;
    case 'settings':
	    view('pages/settings');
	    break;

    default:
        http_response_code(404);
        echo "404 Not Found";
}
