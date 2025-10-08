#!/usr/bin/env python3
"""
Jeu Snake en Python avec pygame
Contrôles: Flèches directionnelles pour déplacer le serpent
Objectif: Manger les pommes rouges pour grandir et marquer des points
"""

import pygame
import random
import sys

# Initialisation de pygame
pygame.init()

# Constantes du jeu
WINDOW_WIDTH = 600
WINDOW_HEIGHT = 400
GRID_SIZE = 20
GRID_WIDTH = WINDOW_WIDTH // GRID_SIZE
GRID_HEIGHT = WINDOW_HEIGHT // GRID_SIZE

# Couleurs (RGB)
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
RED = (255, 0, 0)
GREEN = (34, 139, 34)  # Vert forêt pour le fond
SNAKE_GREEN = (0, 255, 0)  # Vert vif pour le serpent
SNAKE_DARK_GREEN = (0, 200, 0)  # Vert foncé pour la tête
APPLE_RED = (220, 20, 60)  # Rouge pomme
BROWN = (139, 69, 19)  # Marron pour la tige de la pomme
OBSTACLE_COLOR = (64, 64, 64)  # Gris foncé pour les obstacles
SPEED_BONUS_COLOR = (255, 255, 0)  # Jaune pour bonus vitesse
SLOW_BONUS_COLOR = (0, 0, 255)  # Bleu pour bonus ralentissement

# Directions possibles
UP = (0, -1)
DOWN = (0, 1)
LEFT = (-1, 0)
RIGHT = (1, 0)

class Snake:
    """Classe représentant le serpent"""
    
    def __init__(self):
        # Position initiale du serpent (centre de l'écran)
        self.body = [(GRID_WIDTH // 2, GRID_HEIGHT // 2)]
        self.direction = RIGHT
        self.grow = False
    
    def move(self):
        """Déplace le serpent dans la direction actuelle"""
        head_x, head_y = self.body[0]
        new_head = (head_x + self.direction[0], head_y + self.direction[1])
        
        # Ajouter la nouvelle tête
        self.body.insert(0, new_head)
        
        # Si le serpent ne grandit pas, supprimer la queue
        if not self.grow:
            self.body.pop()
        else:
            self.grow = False
    
    def change_direction(self, new_direction):
        """Change la direction du serpent (évite de revenir en arrière)"""
        # Empêcher de revenir en arrière
        if (self.direction[0] * -1, self.direction[1] * -1) != new_direction:
            self.direction = new_direction
    
    def grow_snake(self):
        """Fait grandir le serpent"""
        self.grow = True
    
    def check_collision(self):
        """Vérifie les collisions avec les murs et le corps du serpent"""
        head_x, head_y = self.body[0]
        
        # Collision avec les murs
        if (head_x < 0 or head_x >= GRID_WIDTH or 
            head_y < 0 or head_y >= GRID_HEIGHT):
            return True
        
        # Collision avec le corps du serpent
        if self.body[0] in self.body[1:]:
            return True
        
        return False
    
    def draw(self, screen):
        """Dessine le serpent sur l'écran"""
        for i, segment in enumerate(self.body):
            x = segment[0] * GRID_SIZE
            y = segment[1] * GRID_SIZE
            
            if i == 0:  # Tête du serpent
                # Corps de la tête (ovale)
                pygame.draw.ellipse(screen, SNAKE_DARK_GREEN, (x+2, y+2, GRID_SIZE-4, GRID_SIZE-4))
                # Yeux
                eye_size = 3
                pygame.draw.circle(screen, BLACK, (x+6, y+6), eye_size)
                pygame.draw.circle(screen, BLACK, (x+GRID_SIZE-6, y+6), eye_size)
                # Contour
                pygame.draw.ellipse(screen, BLACK, (x+2, y+2, GRID_SIZE-4, GRID_SIZE-4), 2)
            else:  # Corps du serpent
                # Corps en forme d'ovale
                pygame.draw.ellipse(screen, SNAKE_GREEN, (x+3, y+3, GRID_SIZE-6, GRID_SIZE-6))
                # Écailles (petits cercles)
                scale_x = x + GRID_SIZE//2
                scale_y = y + GRID_SIZE//2
                pygame.draw.circle(screen, SNAKE_DARK_GREEN, (scale_x, scale_y), 4)
                # Contour
                pygame.draw.ellipse(screen, BLACK, (x+3, y+3, GRID_SIZE-6, GRID_SIZE-6), 1)

class Apple:
    """Classe représentant la pomme"""
    
    def __init__(self):
        self.position = self.generate_position()
    
    def generate_position(self):
        """Génère une position aléatoire pour la pomme"""
        x = random.randint(0, GRID_WIDTH - 1)
        y = random.randint(0, GRID_HEIGHT - 1)
        return (x, y)
    
    def respawn(self, snake_body):
        """Repositionne la pomme à un endroit libre"""
        while True:
            self.position = self.generate_position()
            if self.position not in snake_body:
                break
    
    def draw(self, screen):
        """Dessine la pomme sur l'écran"""
        x = self.position[0] * GRID_SIZE
        y = self.position[1] * GRID_SIZE
        
        # Corps de la pomme (cercle)
        center_x = x + GRID_SIZE // 2
        center_y = y + GRID_SIZE // 2
        radius = GRID_SIZE // 2 - 2
        
        pygame.draw.circle(screen, APPLE_RED, (center_x, center_y), radius)
        
        # Tige de la pomme (petit rectangle marron)
        stem_x = center_x - 2
        stem_y = y + 2
        pygame.draw.rect(screen, BROWN, (stem_x, stem_y, 4, 6))
        
        # Feuille de la pomme (petit ovale vert)
        leaf_x = center_x + 2
        leaf_y = y + 1
        pygame.draw.ellipse(screen, GREEN, (leaf_x, leaf_y, 6, 4))
        
        # Contour de la pomme
        pygame.draw.circle(screen, BLACK, (center_x, center_y), radius, 2)

class Obstacle:
    """Classe représentant un obstacle (barre)"""
    
    def __init__(self, x, y, width, height):
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.rect = pygame.Rect(x * GRID_SIZE, y * GRID_SIZE, width * GRID_SIZE, height * GRID_SIZE)
    
    def draw(self, screen):
        """Dessine l'obstacle sur l'écran"""
        pygame.draw.rect(screen, OBSTACLE_COLOR, self.rect)
        pygame.draw.rect(screen, BLACK, self.rect, 2)
    
    def check_collision(self, snake_head):
        """Vérifie si le serpent touche l'obstacle"""
        head_rect = pygame.Rect(snake_head[0] * GRID_SIZE, snake_head[1] * GRID_SIZE, GRID_SIZE, GRID_SIZE)
        return self.rect.colliderect(head_rect)

class Bonus:
    """Classe représentant un bonus (vitesse ou ralentissement)"""
    
    def __init__(self, bonus_type):
        self.type = bonus_type  # 'speed' ou 'slow'
        self.position = self.generate_position()
        self.duration = 100  # Durée en frames (environ 10 secondes à 10 FPS)
        self.active = False
    
    def generate_position(self):
        """Génère une position aléatoire pour le bonus"""
        x = random.randint(0, GRID_WIDTH - 1)
        y = random.randint(0, GRID_HEIGHT - 1)
        return (x, y)
    
    def respawn(self, snake_body, obstacles):
        """Repositionne le bonus à un endroit libre"""
        while True:
            self.position = self.generate_position()
            # Vérifier que la position est libre
            if (self.position not in snake_body and 
                not any(obstacle.check_collision(self.position) for obstacle in obstacles)):
                break
    
    def activate(self):
        """Active le bonus"""
        self.active = True
        self.duration = 100
    
    def update(self):
        """Met à jour la durée du bonus"""
        if self.active:
            self.duration -= 1
            if self.duration <= 0:
                self.active = False
    
    def draw(self, screen):
        """Dessine le bonus sur l'écran"""
        if not self.active:
            return
            
        x = self.position[0] * GRID_SIZE
        y = self.position[1] * GRID_SIZE
        center_x = x + GRID_SIZE // 2
        center_y = y + GRID_SIZE // 2
        
        if self.type == 'speed':
            # Bonus vitesse (éclair jaune)
            color = SPEED_BONUS_COLOR
            # Dessiner un éclair
            points = [
                (center_x, y + 2),
                (center_x + 6, center_y),
                (center_x + 2, center_y),
                (center_x + 8, y + GRID_SIZE - 2),
                (center_x + 2, center_y),
                (center_x - 2, center_y)
            ]
            pygame.draw.polygon(screen, color, points)
        else:
            # Bonus ralentissement (sablier bleu)
            color = SLOW_BONUS_COLOR
            # Dessiner un sablier
            pygame.draw.rect(screen, color, (center_x - 4, y + 2, 8, 6))
            pygame.draw.rect(screen, color, (center_x - 4, y + GRID_SIZE - 8, 8, 6))
            pygame.draw.rect(screen, color, (center_x - 2, center_y - 1, 4, 2))

class Game:
    """Classe principale du jeu"""
    
    def __init__(self):
        self.screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT))
        pygame.display.set_caption("Snake Game")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.Font(None, 36)
        
        self.snake = Snake()
        self.apple = Apple()
        self.obstacles = []
        self.speed_bonus = Bonus('speed')
        self.slow_bonus = Bonus('slow')
        self.score = 0
        self.game_over = False
        self.game_speed = 10  # Vitesse de base (FPS)
        self.speed_modifier = 1.0  # Modificateur de vitesse
        self.obstacle_timer = 0  # Timer pour l'apparition d'obstacles
    
    def handle_events(self):
        """Gère les événements du jeu"""
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return False
            
            if event.type == pygame.KEYDOWN:
                if self.game_over:
                    if event.key == pygame.K_SPACE:
                        self.restart_game()
                else:
                    # Contrôles du serpent
                    if event.key == pygame.K_UP:
                        self.snake.change_direction(UP)
                    elif event.key == pygame.K_DOWN:
                        self.snake.change_direction(DOWN)
                    elif event.key == pygame.K_LEFT:
                        self.snake.change_direction(LEFT)
                    elif event.key == pygame.K_RIGHT:
                        self.snake.change_direction(RIGHT)
        
        return True
    
    def create_obstacle(self):
        """Crée un nouvel obstacle aléatoire"""
        # Types d'obstacles possibles
        obstacle_types = [
            (1, 3),  # Barre verticale
            (3, 1),  # Barre horizontale
            (2, 2),  # Carré
        ]
        
        width, height = random.choice(obstacle_types)
        x = random.randint(0, GRID_WIDTH - width)
        y = random.randint(0, GRID_HEIGHT - height)
        
        # Vérifier que l'obstacle ne gêne pas le serpent ou la pomme
        obstacle = Obstacle(x, y, width, height)
        if (not obstacle.check_collision(self.snake.body[0]) and 
            not obstacle.check_collision(self.apple.position)):
            self.obstacles.append(obstacle)
    
    def update(self):
        """Met à jour la logique du jeu"""
        if not self.game_over:
            # Déplacer le serpent
            self.snake.move()
            
            # Vérifier les collisions avec les murs et le corps
            if self.snake.check_collision():
                self.game_over = True
                return
            
            # Vérifier les collisions avec les obstacles
            for obstacle in self.obstacles:
                if obstacle.check_collision(self.snake.body[0]):
                    self.game_over = True
                    return
            
            # Vérifier si le serpent mange la pomme
            if self.snake.body[0] == self.apple.position:
                self.snake.grow_snake()
                self.score += 10
                self.apple.respawn(self.snake.body)
                
                # Supprimer tous les obstacles quand une pomme est mangée
                self.obstacles.clear()
                self.obstacle_timer = 0
            
            # Vérifier les collisions avec les bonus
            if self.speed_bonus.active and self.snake.body[0] == self.speed_bonus.position:
                self.speed_modifier = 1.5  # Accélération
                self.speed_bonus.active = False
                self.score += 5
            
            if self.slow_bonus.active and self.snake.body[0] == self.slow_bonus.position:
                self.speed_modifier = 0.5  # Ralentissement
                self.slow_bonus.active = False
                self.score += 5
            
            # Gérer l'apparition d'obstacles
            self.obstacle_timer += 1
            if self.obstacle_timer >= 200:  # Toutes les 20 secondes
                if random.random() < 0.3:  # 30% de chance
                    self.create_obstacle()
                self.obstacle_timer = 0
            
            # Gérer l'apparition de bonus
            if not self.speed_bonus.active and random.random() < 0.01:  # 1% de chance par frame
                self.speed_bonus.respawn(self.snake.body, self.obstacles)
                self.speed_bonus.activate()
            
            if not self.slow_bonus.active and random.random() < 0.01:  # 1% de chance par frame
                self.slow_bonus.respawn(self.snake.body, self.obstacles)
                self.slow_bonus.activate()
            
            # Mettre à jour les bonus
            self.speed_bonus.update()
            self.slow_bonus.update()
            
            # Réinitialiser le modificateur de vitesse après un certain temps
            if self.speed_modifier != 1.0:
                if random.random() < 0.02:  # 2% de chance par frame
                    self.speed_modifier = 1.0
    
    def draw(self):
        """Dessine tous les éléments du jeu"""
        # Effacer l'écran avec fond vert
        self.screen.fill(GREEN)
        
        if not self.game_over:
            # Dessiner les obstacles
            for obstacle in self.obstacles:
                obstacle.draw(self.screen)
            
            # Dessiner les bonus
            self.speed_bonus.draw(self.screen)
            self.slow_bonus.draw(self.screen)
            
            # Dessiner le serpent et la pomme
            self.snake.draw(self.screen)
            self.apple.draw(self.screen)
        
        # Afficher le score et les informations
        score_text = self.font.render(f"Score: {self.score}", True, WHITE)
        self.screen.blit(score_text, (10, 10))
        
        # Afficher le modificateur de vitesse
        if self.speed_modifier != 1.0:
            speed_text = f"Vitesse: {self.speed_modifier:.1f}x"
            color = SPEED_BONUS_COLOR if self.speed_modifier > 1.0 else SLOW_BONUS_COLOR
            speed_surface = self.font.render(speed_text, True, color)
            self.screen.blit(speed_surface, (10, 50))
        
        # Afficher le message de fin de jeu
        if self.game_over:
            game_over_text = self.font.render("GAME OVER!", True, WHITE)
            restart_text = self.font.render("Appuyez sur ESPACE pour recommencer", True, WHITE)
            
            # Centrer les textes
            game_over_rect = game_over_text.get_rect(center=(WINDOW_WIDTH//2, WINDOW_HEIGHT//2 - 20))
            restart_rect = restart_text.get_rect(center=(WINDOW_WIDTH//2, WINDOW_HEIGHT//2 + 20))
            
            self.screen.blit(game_over_text, game_over_rect)
            self.screen.blit(restart_text, restart_rect)
        
        # Mettre à jour l'affichage
        pygame.display.flip()
    
    def restart_game(self):
        """Redémarre le jeu"""
        self.snake = Snake()
        self.apple = Apple()
        self.obstacles.clear()
        self.speed_bonus = Bonus('speed')
        self.slow_bonus = Bonus('slow')
        self.score = 0
        self.game_over = False
        self.speed_modifier = 1.0
        self.obstacle_timer = 0
    
    def run(self):
        """Boucle principale du jeu"""
        running = True
        
        while running:
            # Gérer les événements
            running = self.handle_events()
            
            # Mettre à jour la logique du jeu
            self.update()
            
            # Dessiner le jeu
            self.draw()
            
            # Contrôler la vitesse du jeu avec modificateur
            current_speed = int(self.game_speed * self.speed_modifier)
            self.clock.tick(current_speed)
        
        pygame.quit()
        sys.exit()

def main():
    """Fonction principale"""
    print("=== JEU SNAKE AVANCÉ ===")
    print("Contrôles:")
    print("- Flèches directionnelles: Déplacer le serpent")
    print("- ESPACE: Recommencer après Game Over")
    print("- Fermer la fenêtre: Quitter")
    print("\nObjectif: Manger les pommes rouges pour grandir et marquer des points!")
    print("Attention: Évitez les murs, votre propre corps et les obstacles gris!")
    print("\nBonus:")
    print("- ⚡ Éclair jaune: Accélération (1.5x vitesse)")
    print("- ⏳ Sablier bleu: Ralentissement (0.5x vitesse)")
    print("- 🍎 Pomme: Supprime tous les obstacles + 10 points")
    print("- Obstacles: Apparaissent aléatoirement, disparaissent quand vous mangez une pomme")
    
    # Créer et lancer le jeu
    game = Game()
    game.run()

if __name__ == "__main__":
    main()
