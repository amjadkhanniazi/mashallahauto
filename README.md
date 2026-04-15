# MashAllah Auto

MashAllah Auto is a static business landing page for a Lahore-based car mechanic service. The page presents the brand, highlights core services such as car repair, doorstep mechanic support, and towing, and gives visitors a fast way to contact the business.

The project is intentionally lightweight. It consists of a single HTML file and a simple Docker setup that serves the page with Nginx.

## Project Structure

- `mashallah-auto.html` - main landing page content and styling
- `Dockerfile` - container setup for serving the page as `index.html` with Nginx
- `.gitignore` - common ignore rules for local development files

## Features

- Static marketing website for MashAllah Auto
- Mobile-friendly single-page layout
- Business-focused content for local automotive services
- Docker-ready deployment with Nginx

## Run With Docker

Build the image:

```bash
docker build -t mashallah-auto .
```

Run the container:

```bash
docker run -p 8080:80 mashallah-auto
```

Then open `http://localhost:8080`.

## Local Development

Since this is a static HTML project, you can also open `mashallah-auto.html` directly in a browser for quick previewing. For production-style serving, use Docker with the included `Dockerfile`.
