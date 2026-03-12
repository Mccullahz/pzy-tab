<?php ob_start(); ?>

<?php //this is the home page for the application. should have widgets for the user to interact with that will redirect to other pages. currently a test layout as i figure out the structure etc.
?>

<?php
$content = ob_get_clean();
$title = "Pzy-Tab";

view('layouts/main', compact('content', 'title'));
?>

<link href="/css/app.css" rel="stylesheet">


<body class="bg-gray-950 text-white overflow-x-hidden">

<?php
// defining vars for content of the widgets here, not the most ideal way to do this but we are playing with things here.
// I will eventually want to combine this into one array of objs to prevent desync but this is working for now. Problem with the current approach is if I have 5 titles but 6 contents things will be all out of order
$widtitles = ["Dashboard", "Profiles", "Settings"];
$widcontents = ["Roaster Control.", "Load / Tweak Profiles.", "Cog Wheel."];
?>
<?php view('components/widget', compact('widtitles', 'widcontents')); ?>

</body>

