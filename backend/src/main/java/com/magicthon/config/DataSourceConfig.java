package com.magicthon.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.net.URI;

@Configuration
public class DataSourceConfig {

    @Bean
    @Primary
    public DataSource dataSource() {
        String dbUrl = System.getenv("DATABASE_URL");
        DataSourceBuilder<HikariDataSource> builder = DataSourceBuilder.create().type(HikariDataSource.class);

        if (dbUrl != null && !dbUrl.isBlank() && (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://"))) {
            URI uri = URI.create(dbUrl.replaceFirst("^postgres://", "postgresql://"));
            String userInfo = uri.getUserInfo();
            String user = userInfo != null && userInfo.contains(":") ? userInfo.substring(0, userInfo.indexOf(':')) : userInfo;
            String pass = userInfo != null && userInfo.contains(":") ? userInfo.substring(userInfo.indexOf(':') + 1) : "";
            String host = uri.getHost();
            int port = uri.getPort() == -1 ? 5432 : uri.getPort();
            String path = uri.getPath() == null ? "" : uri.getPath();
            String query = uri.getRawQuery() == null ? "sslmode=require" : uri.getRawQuery();
            String jdbc = "jdbc:postgresql://" + host + ":" + port + path + "?" + query;
            return builder.url(jdbc).username(user).password(pass).driverClassName("org.postgresql.Driver").build();
        }

        // Fallback: use spring.datasource.* from application.yml
        String fallbackUrl = System.getProperty("spring.datasource.url",
                System.getenv().getOrDefault("DATABASE_JDBC_URL", "jdbc:postgresql://localhost:5432/magicthon"));
        String fallbackUser = System.getenv().getOrDefault("DATABASE_USER", "postgres");
        String fallbackPass = System.getenv().getOrDefault("DATABASE_PASSWORD", "postgres");
        return builder.url(fallbackUrl).username(fallbackUser).password(fallbackPass).driverClassName("org.postgresql.Driver").build();
    }
}
