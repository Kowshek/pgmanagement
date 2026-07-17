# Stage 1: Build dependencies
FROM python:3.12-slim AS builder

WORKDIR /build

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install base tools
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Copy project files needed for installation
COPY pyproject.toml ./
COPY app ./app

# Install project dependencies
RUN pip install --no-cache-dir .

# Stage 2: Runtime
FROM python:3.12-slim

WORKDIR /app

# Create a non-root user and group
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application code
COPY app ./app

# Copy Alembic config + migration scripts too — not imported by the app at
# runtime, but needed so `alembic upgrade head` can actually run inside this
# image (e.g. Railway's preDeployCommand). Without these two, the container
# has no alembic.ini/versions to find and migrations silently can't run
# in-container, only from a developer's own machine against the DB directly.
COPY alembic.ini ./
COPY alembic ./alembic

# Set ownership
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
