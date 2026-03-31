import asyncpg


async def create_pool(database_url: str) -> asyncpg.Pool:
    return await asyncpg.create_pool(
        database_url, min_size=2, max_size=15, statement_cache_size=0
    )
