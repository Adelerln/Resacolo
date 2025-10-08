import ast
import operator as op

# Safe operators allowed
_OPS = {
    ast.Add: op.add,
    ast.Sub: op.sub,
    ast.Mult: op.mul,
    ast.Div: op.truediv,
    ast.FloorDiv: op.floordiv,
    ast.Mod: op.mod,
    ast.Pow: op.pow,
    ast.USub: op.neg,
    ast.UAdd: op.pos,
}

def evaluate_expression(expression: str):
    """Safely evaluate a math expression with +, -, *, /, //, %, ** and parentheses."""
    node = ast.parse(expression, mode="eval").body
    return _eval_node(node)

def _eval_node(node):
    if isinstance(node, ast.Num):  # Python <=3.7 number literal
        return node.n
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
        left = _eval_node(node.left)
        right = _eval_node(node.right)
        return _OPS[type(node.op)](left, right)
    if isinstance(node, ast.UnaryOp) and type(node.op) in _OPS:
        operand = _eval_node(node.operand)
        return _OPS[type(node.op)](operand)
    raise ValueError("Expression non supportée")

if __name__ == "__main__":
    try:
        expr = input("Entrez un calcul: ")
        result = evaluate_expression(expr)
        print(f"= {result}")
    except Exception as e:
        print(f"Erreur: {e}")