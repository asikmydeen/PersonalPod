#!/bin/bash

# Create SSL directory
SSL_DIR="./nginx/ssl"
mkdir -p "$SSL_DIR"

# Generate private key
openssl genrsa -out "$SSL_DIR/localhost.key" 2048

# Generate certificate signing request
openssl req -new -key "$SSL_DIR/localhost.key" -out "$SSL_DIR/localhost.csr" -subj "/C=US/ST=State/L=City/O=PersonalPod/CN=localhost"

# Generate self-signed certificate
openssl x509 -req -days 365 -in "$SSL_DIR/localhost.csr" -signkey "$SSL_DIR/localhost.key" -out "$SSL_DIR/localhost.crt"

# Create a certificate configuration file for additional domains
cat > "$SSL_DIR/localhost.conf" <<EOF
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = State
L = City
O = PersonalPod
CN = localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
DNS.3 = personalpod.local
DNS.4 = *.personalpod.local
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

# Generate certificate with Subject Alternative Names
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$SSL_DIR/localhost.key" \
  -out "$SSL_DIR/localhost.crt" \
  -config "$SSL_DIR/localhost.conf" \
  -extensions v3_req

# Clean up
rm -f "$SSL_DIR/localhost.csr"

echo "SSL certificates generated successfully in $SSL_DIR"
echo "Certificate details:"
openssl x509 -in "$SSL_DIR/localhost.crt" -text -noout | grep -E "(Subject:|DNS:|IP:)"