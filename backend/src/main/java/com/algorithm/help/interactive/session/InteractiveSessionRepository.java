package com.algorithm.help.interactive.session;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 交互会话 Repository
 */
public interface InteractiveSessionRepository extends JpaRepository<InteractiveSession, String> {

    List<InteractiveSession> findByUserIdAndStatusOrderByCreatedAtDesc(String userId, SessionStatus status);

    List<InteractiveSession> findByStatusAndLastActiveAtBefore(SessionStatus status, Long threshold);
}
