%begin%
CREATE DATABASE IF NOT EXISTS %database_name%;
%end%

CREATE USER 'root'@'localhost' IDENTIFIED BY 'local';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%';
