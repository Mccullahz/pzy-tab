<?php
// take an array of data and a view path, convert to variables, load the view file
function view($path, $data = [])
{
//extract() takes the keys of an associative array and turns them into variables in the current scope. ONLY VALID VAR NAMES
    extract($data);
    include __DIR__ . "/../Views/$path.php";
}
