package com.algorithm.help.auth.config;

import com.algorithm.help.auth.filter.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Spring Security 配置 — 三级权限模型
 * <p>
 * 公开 API：无需认证
 * 认证 API：USER + ADMIN
 * 管理员 API：ADMIN only
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;

    @Value("${app.cors.allowed-origins:http://localhost:3000}")
    private List<String> allowedOrigins;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> configureAuthorization(auth))
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    /** CORS 配置：允许的源从 application.yml 读取 */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    /** 配置三级权限规则 */
    private void configureAuthorization(
            org.springframework.security.config.annotation.web.configurers.AuthorizeHttpRequestsConfigurer<HttpSecurity>.AuthorizationManagerRequestMatcherRegistry auth) {
        // 内部 API — 由 InternalTokenFilter 单独鉴权，跳过 JWT
        auth
                .requestMatchers("/api/v1/internal/**").permitAll();

        // WebSocket 端点 — 由 WsAuthInterceptor 单独鉴权
        auth
                .requestMatchers("/ws/**").permitAll();

        // 公开 API — 无需认证
        auth
                .requestMatchers(HttpMethod.GET, "/api/v1/problems/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/patterns/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/companies").permitAll()
                .requestMatchers("/api/v1/auth/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/actuator/health").permitAll();

        // 知识图谱 API — 游客只读访问
        auth
                .requestMatchers(HttpMethod.GET, "/api/graph/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/graph/**").permitAll()
                // 用户进度图谱 — 凭借 X-User-Id header 访问，未登录返回演示数据
                .requestMatchers(HttpMethod.GET, "/api/v1/user/progress/graph").permitAll();

        // 训练 API — 游客可访问（用户ID通过请求体/路径传递）
        auth
                .requestMatchers("/api/training/**").permitAll()
                .requestMatchers("/api/v1/training/**").permitAll()
                // 题目推荐 API — 游客可读
                .requestMatchers(HttpMethod.GET, "/api/v1/problems/*/recommend").permitAll()
                // 交互会话 API — 游客可访问（userId 通过请求体传递）
                .requestMatchers("/api/v1/sessions/**").permitAll()
                // 各 interactive 模式 — 游客可访问
                .requestMatchers("/api/v1/feynman/**").permitAll()
                .requestMatchers("/api/v1/socratic/**").permitAll()
                .requestMatchers("/api/v1/debug/**").permitAll()
                .requestMatchers("/api/v1/interview/**").permitAll()
                .requestMatchers("/api/v1/reverse-feynman/**").permitAll()
                // 复习中心 — 游客可读写
                .requestMatchers("/api/v1/review/**").permitAll()
                // 学习分析（热力图等）— 游客可读
                .requestMatchers(HttpMethod.GET, "/api/v1/analytics/**").permitAll()
                // 成就系统 — 游客可读，check 需认证
                .requestMatchers(HttpMethod.GET, "/api/v1/achievements/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/achievements/check").permitAll()
                // 跨域映射 API — 游客可读
                .requestMatchers(HttpMethod.GET, "/api/patterns/**").permitAll()
                // 算法考古 API — 游客可读
                .requestMatchers(HttpMethod.GET, "/api/archaeology/**").permitAll()
                // 论文桥梁 API — 游客可读
                .requestMatchers(HttpMethod.GET, "/api/paper-bridge/**").permitAll();

        // Enriched 公开 API — 游客只读访问（列表/详情/标签/进度）
        auth
                .requestMatchers(HttpMethod.GET, "/api/v1/enriched/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/raw-solutions/**").permitAll();

        // 管理员 API — ADMIN only
        auth
                .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/v1/batch/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/v1/seed/**").hasRole("ADMIN");

        // Enriched 生成/取消 — 登录用户（USER + ADMIN）
        auth
                .requestMatchers(HttpMethod.POST, "/api/v1/enriched/*/generate").hasAnyRole("USER", "ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/v1/enriched/tasks/*").hasAnyRole("USER", "ADMIN");

        // 认证 API — USER + ADMIN
        auth
                .requestMatchers(HttpMethod.POST, "/api/v1/problems/*/generate").hasAnyRole("USER", "ADMIN")
                .requestMatchers("/api/v1/users/me/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/v1/problems/*/feedback").hasAnyRole("USER", "ADMIN");

        // 其他请求 — 需要认证
        auth.anyRequest().authenticated();
    }
}
