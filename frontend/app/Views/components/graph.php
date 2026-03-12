<?php

// this component will handle the rendering of our graphs. without using a js library this is going to be a bit of a pita.

// render out a canvas element for where our graphing is going to go:
?>

<link href="/css/app.css" rel="stylesheet">

<div class="bg-gray-950 p-4 rounded-lg shadow-md">
  <h2 class="text-xl font-bold flex justify-center mb-1">Graph Widget</h2>
  <p class="text-gray-300 text-xl flex justify-center mb-4">
  +
<br>
  |
<br>
  |
<br>
  |
<br>
  |
<br>
  |
<br>
  |
<br>
  + - - - - - - - - - - - - - - - - - - ->
<br>
This is.... a graph.
  </p>
  <canvas id="Chart" width="400" height="100"></canvas>

