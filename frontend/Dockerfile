FROM php:8.3-fpm-alpine

WORKDIR /var/www

RUN apk add --no-cache \
    bash \
    git \
    curl \
    libzip-dev \
    oniguruma-dev \
    icu-dev \
    && docker-php-ext-install pdo pdo_mysql zip intl

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY . .

EXPOSE 9000

CMD ["php-fpm"]
