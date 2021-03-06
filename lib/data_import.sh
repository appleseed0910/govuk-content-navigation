#!/bin/sh

set -e

bundle install
pip install -r requirements.txt

echo
read -p "Enter the environment: " environment
read -p "Enter http auth username: " username
read -s -p "Enter http auth password: " password
echo

export HTTP_AUTH_USER=$username
export HTTP_AUTH_PASS=$password
export DATA_ENVIRONMENT=$environment

python lib/python/format_finder.py
python lib/python/fetch_main_content.py
bundle exec rake
