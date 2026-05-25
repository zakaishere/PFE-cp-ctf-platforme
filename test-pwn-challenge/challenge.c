#include <stdio.h>
#include <string.h>
#include <stdlib.h>

int main() {
    /* Disable buffering so every write reaches the socket immediately. */
    setvbuf(stdout, NULL, _IONBF, 0);
    setvbuf(stdin,  NULL, _IONBF, 0);

    char buf[128];

    puts("================================");
    puts("   PSP CTF — Test PWN Challenge ");
    puts("================================");
    puts("Type 'flag' to get the flag.");
    printf("> ");

    if (fgets(buf, sizeof(buf), stdin) == NULL) return 0;

    /* Strip trailing newline */
    buf[strcspn(buf, "\n")] = '\0';

    if (strcmp(buf, "flag") == 0) {
        const char *flag = getenv("FLAG");
        printf("%s\n", flag ? flag : "FLAG_NOT_SET");
    } else {
        printf("Wrong command. Try 'flag'.\n");
    }

    return 0;
}
