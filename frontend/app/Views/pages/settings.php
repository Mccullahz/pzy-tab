<?php // profile page to load and manage roasting profiles. this will be the place to crud the profiles, and also to laod them into the dash. ?>
<?php ob_start(); ?>

<?php
$content = ob_get_clean();
$title = "Pzy-Tab";

view('layouts/main', compact('content', 'title'));
?>

<link href="/css/app.css" rel="stylesheet">


<body class="bg-gray-950 text-white overflow-x-hidden">

<?php
echo "<div class='p-6'>";
echo "<h1 class='text-3xl flex justify-center font-bold mb-4'>Settings</h1>";
?>

</body>

