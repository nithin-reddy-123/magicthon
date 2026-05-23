package com.magicthon.dto;

import jakarta.validation.constraints.NotBlank;

public record SaveMemeRequest(
        @NotBlank String imageBase64,
        String contentType,
        String caption
) {}
