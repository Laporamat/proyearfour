FROM python:3.12-slim

# System build dependencies for Python packages (curl_cffi, lxml, jq, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ make \
    libcurl4-openssl-dev libssl-dev \
    libxml2-dev libxslt1-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

# Install Python dependencies — skip litellm (private wheel URL, not imported anywhere)
COPY backend/requirements.txt /tmp/requirements.txt
RUN grep -v '^litellm' /tmp/requirements.txt > /tmp/req_filtered.txt && \
    pip install --no-cache-dir -r /tmp/req_filtered.txt

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]
