<?php ob_start(); ?>

<?php //this is the main page for the application. should have widgets for the user to interact with that will redirect to other pages. currently a test layout as i figure out the structure etc.
?>

<?php
$content = ob_get_clean();
$title = "Pzy-Tab";

view('layouts/main', compact('content', 'title'));
?>

<link href="/css/app.css" rel="stylesheet">


<body>
	<?php
// just rendering the graph component for now, but this page should handle the start / stop of the data collection as well
view('components/graph');
view('components/controls'); // and so fourth
	?>

</body>

