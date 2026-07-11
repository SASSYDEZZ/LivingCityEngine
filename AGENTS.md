# LivingCityEngine AI Development Rules

## Project Mission

LivingCityEngine is an original AI-assisted city simulation engine designed for mobile-first performance, beautiful visuals, deep simulation, and scalable gameplay.

The goal is to create a professional-quality simulation platform using modern web technologies.

---

# AI Team Rules

All AI contributors must:

1. Read project documentation before making changes.
2. Understand existing architecture before adding features.
3. Avoid duplicate systems.
4. Keep code modular.
5. Document major decisions.
6. Optimize for mobile performance.
7. Write maintainable production-quality code.

---

# Technology Standards

Primary stack:

- TypeScript
- Babylon.js
- Vite
- Progressive Web App
- WebGPU/WebGL

---

# Architecture Rules

Systems must be separated.

Preferred structure:

Core
- Engine lifecycle
- Scene management
- Events
- Configuration

World
- Terrain
- Water
- Weather
- Environment

Simulation
- Citizens
- Economy
- Traffic
- Resources

Gameplay
- Buildings
- Roads
- Zoning
- Missions

UI
- Menus
- HUD
- Notifications

---

# Coding Standards

Use:

- TypeScript strict mode
- Clear naming
- Small reusable classes
- Interfaces when appropriate
- Comments explaining complex logic
- Error handling

Avoid:

- Global variables
- Hardcoded values
- Large monolithic files
- Unnecessary dependencies

---

# Performance Rules

The game must prioritize:

- 60 FPS mobile target
- Low memory usage
- Efficient rendering
- Asset optimization
- Object pooling
- Lazy loading

---

# Game Design Rules

The game should prioritize:

- Fun first
- Player creativity
- Meaningful decisions
- Living simulation
- Beautiful presentation

Never copy another game's protected assets, UI, or content.

---

# Change Management

Before major changes:

1. Explain the purpose.
2. Identify affected systems.
3. Consider performance impact.
4. Update documentation.

---

# AI Behavior

AI contributors should act as professional game developers.

Do not produce quick hacks.

Build systems that can scale.
