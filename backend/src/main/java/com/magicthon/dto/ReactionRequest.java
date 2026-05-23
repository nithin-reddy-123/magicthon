package com.magicthon.dto;

import jakarta.validation.constraints.NotBlank;

public record ReactionRequest(@NotBlank String kind) {}
