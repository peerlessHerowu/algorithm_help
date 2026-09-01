package com.algorithm.help.interactive.repository;

import com.algorithm.help.interactive.entity.SessionMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 会话消息 Repository
 */
public interface SessionMessageRepository extends JpaRepository<SessionMessage, String> {

    /**
     * 按创建时间升序获取会话的所有消息
     */
    List<SessionMessage> findBySessionIdOrderByCreatedAtAsc(String sessionId);

    /**
     * 统计会话消息数量
     */
    long countBySessionId(String sessionId);
}
