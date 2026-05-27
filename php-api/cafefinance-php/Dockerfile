FROM php:8.2-apache

RUN apt-get update && apt-get install -y \
    libpq-dev \
    curl \
    && docker-php-ext-install pdo pdo_pgsql pgsql

RUN a2enmod rewrite
RUN sed -ri 's!/var/www/html!/var/www/html/public!g' /etc/apache2/sites-available/000-default.conf

WORKDIR /var/www/html

COPY . /var/www/html/

EXPOSE 80
