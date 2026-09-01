package com.algorithm.help.auth.dto;

import com.algorithm.help.auth.enums.Role;
import com.algorithm.help.auth.enums.Tier;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * 用户信息响应 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserInfoResponse {

    private UUID id;
    private String email;
    private String nickname;
    private Role role;
    private Tier tier;
}
