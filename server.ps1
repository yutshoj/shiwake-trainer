param(
  [int]$Port = 4173,
  [string]$Root = $PSScriptRoot
)

Add-Type -AssemblyName System.Web

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"
  ".webmanifest" = "application/manifest+json; charset=utf-8"
  ".svg" = "image/svg+xml; charset=utf-8"
  ".png" = "image/png"
}

$rootPath = [System.IO.Path]::GetFullPath($Root)
$server = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), $Port)
$server.Start()

while ($true) {
  $client = $server.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $buffer = [byte[]]::new(8192)
    $read = $stream.Read($buffer, 0, $buffer.Length)
    if ($read -le 0) {
      continue
    }

    $requestText = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $read)
    $requestLine = ($requestText -split "`r?`n")[0]

    $target = "index.html"
    if ($requestLine -match "^[A-Z]+\s+([^ ]+)") {
      $target = [System.Web.HttpUtility]::UrlDecode($Matches[1].TrimStart("/"))
      if ([string]::IsNullOrWhiteSpace($target)) {
        $target = "index.html"
      }
    }

    $file = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($rootPath, $target))
    $status = "200 OK"
    $body = [byte[]]::new(0)
    $contentType = "application/octet-stream"

    if (-not $file.StartsWith($rootPath)) {
      $status = "403 Forbidden"
      $body = [System.Text.Encoding]::UTF8.GetBytes("Forbidden")
      $contentType = "text/plain; charset=utf-8"
    } elseif ([System.IO.File]::Exists($file)) {
      $extension = [System.IO.Path]::GetExtension($file)
      $contentType = if ($mimeTypes.ContainsKey($extension)) { $mimeTypes[$extension] } else { "application/octet-stream" }
      $body = [System.IO.File]::ReadAllBytes($file)
    } else {
      $status = "404 Not Found"
      $body = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
      $contentType = "text/plain; charset=utf-8"
    }

    $header = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    $stream.Write($body, 0, $body.Length)
  } catch {
    try {
      $body = [System.Text.Encoding]::UTF8.GetBytes("Server Error")
      $header = "HTTP/1.1 500 Internal Server Error`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      $stream.Write($body, 0, $body.Length)
    } catch {}
  } finally {
    $client.Close()
  }
}
