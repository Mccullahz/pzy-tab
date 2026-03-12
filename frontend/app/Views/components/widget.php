<?php
// this component is a simple widget that will be utilized on the home screen for purposes of navigation and quick access to other pages.
?>

<link href="/css/app.css" rel="stylesheet">

<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6">

<?php
// go through items and display them in a grid format, each title will create a 'widget' card with the content inside of it.
// get length of widtitles, and use that to determine how many widgets to create

$len = count($widtitles);

for ($i = 0; $i < $len; $i++) {
	if ($widtitles[$i] == "Dashboard") {
		$href = "/?page=dash";
	} else if ($widtitles[$i] == "Profiles") {
		$href = "/?page=profile";
	} else if ($widtitles[$i] == "Settings") {
		$href = "/?page=settings";
	}
	  else {
		$href = "/?page=home";
	}

	echo "<a href='$href' class='grid h-56 grid-cols-3 content-evenly content-stretch content-center gap-4'>";
	echo "<div class='bg-gray-800 p-6 min-w-100% rounded-2xl shadow-md shadow-indigo-950 active:scale-95 transition transform duration-150'>";
	
	echo "<h2 class='text-2xl flex justify-center font-semibold mb-2'>";
	echo $widtitles[$i];
	echo "</h2>";

	echo "<p class='text-slate-400 flex justify-center text-sm'>";
	echo $widcontents[$i];
	echo "</p>";

	echo "</div>";
	echo "</a>";
}
?>

</div>
