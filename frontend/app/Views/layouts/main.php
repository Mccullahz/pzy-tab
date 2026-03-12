<?php
$title = $title ?? 'PZY';
?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title><?= htmlspecialchars($title) ?></title>
  <link href="/css/app.css" rel="stylesheet">
</head>
<body class="bg-gray-950 text-white overflow-x-hidden">

  <?php view('components/navbar'); ?>
  <main class="max-w-100% mx-auto p-6">
    <?= $content ?>
  </main>
</body>
<?php view('components/footer'); ?>
</html>
