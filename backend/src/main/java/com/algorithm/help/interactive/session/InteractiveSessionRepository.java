package com.algorithm.help.interactive.session;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;


import java.util.List;

/**
 * 交互会话 Repository
 */
public interface InteractiveSessionRepository extends JpaRepository<InteractiveSession, String> {

    List<InteractiveSession> findByUserIdAndStatusOrderByCreatedAtDesc(String userId, SessionStatus status);

    List<InteractiveSession> findByStatusAndLastActiveAtBefore(SessionStatus status, Long threshold);

    @Query("SELECT DISTINCT s.userId FROM InteractiveSession s WHERE s.lastActiveAt >= :since")
    java.util.List<String> findDistinctUserIdsActiveSince(@Param("since") Long since);
}
