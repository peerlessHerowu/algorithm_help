package com.algorithm.help.auth.repository;

import com.algorithm.help.auth.entity.UserPreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/**
 * 用户偏好数据访问层
 */
public interface UserPreferenceRepository extends JpaRepository<UserPreference, UUID> {
}
